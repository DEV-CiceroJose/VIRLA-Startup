import { db } from '../lib/firestore.js'
import { nowTs } from '../repositories/_helpers.js'
import * as paymentRepo from '../repositories/paymentRepository.js'
import { getByPaymentId as getEscrowByPaymentId } from '../repositories/escrowRepository.js'
import { getUserById } from '../repositories/userRepository.js'
import { getById as getChargeById } from '../repositories/chargeRequestRepository.js'
import { logger } from '../lib/logger.js'
import { createBilling, getBillingStatus } from '../services/abacatePayService.js'
import { createEscrowForPayment, holdEscrowFunds } from '../services/escrowService.js'
import { validateAmountCents } from '../utils/validation.js'
import { markChargePaidForPayment } from '../services/chargeRequestService.js'

function normalizeGatewayStatus(status) {
  const up = String(status ?? '').toUpperCase()
  if (up === 'PAID') return 'PAID'
  if (up === 'EXPIRED') return 'EXPIRED'
  if (up === 'CANCELED' || up === 'CANCELLED') return 'CANCELED'
  return 'PENDING'
}

export const initiateBilling = async (req, res) => {
  try {
    const userId = req.userId

    const user = await getUserById(userId)
    if (!user) {
      return res.status(404).json({ msg: 'Usuário não encontrado.' })
    }

    const { amount, description, taxId, cellphone, payeeId, chargeRequestId } = req.body

    const amountCheck = validateAmountCents(amount)
    if (!amountCheck.valid) {
      return res.status(422).json({ msg: amountCheck.error })
    }

    const payee = await getUserById(payeeId)
    if (!payee) {
      return res.status(404).json({ msg: 'Cuidador não encontrado.' })
    }
    if (payee.role !== 'CUIDADOR') {
      return res.status(422).json({ msg: 'payeeId deve referenciar um usuário CUIDADOR.' })
    }
    if (payeeId === userId) {
      return res.status(422).json({ msg: 'O cuidador não pode ser o próprio pagador.' })
    }

    let chargeRequest = null
    if (chargeRequestId) {
      chargeRequest = await getChargeById(chargeRequestId)
      if (!chargeRequest || chargeRequest.status !== 'PENDING') {
        return res.status(404).json({ msg: 'Cobrança não encontrada ou já processada.' })
      }
      if (chargeRequest.familiarId !== userId) {
        return res.status(403).json({ msg: 'Esta cobrança não pertence a você.' })
      }
      if (chargeRequest.caregiverId !== payeeId) {
        return res.status(422).json({ msg: 'Cuidador não corresponde à cobrança.' })
      }
      if (chargeRequest.totalAmount !== amountCheck.amount) {
        return res.status(422).json({
          msg: 'Valor do pagamento não confere com a cobrança gerada pelo cuidador.',
        })
      }
    }

    let billing
    try {
      billing = await createBilling({
        user: { name: user.name, email: user.email, taxId, cellphone },
        amount: amountCheck.amount,
        description: description ?? chargeRequest?.description ?? 'Serviço Virla',
      })
    } catch (err) {
      logger.error('payment:gateway_error', { error: err.message, userId, endpoint: req.originalUrl })
      const isValidation =
        err.message.startsWith('CPF') ||
        err.message.startsWith('E-mail') ||
        err.message.startsWith('Valor inválido')
      return res.status(isValidation ? 422 : 502).json({
        msg: isValidation ? err.message : 'Falha ao comunicar com o gateway de pagamento.',
      })
    }

    const { payment, escrow } = await db.runTransaction(async (tx) => {
      const paymentRef = paymentRepo.paymentsCol().doc()
      tx.set(paymentRef, {
        billingId: billing.billingId,
        // CORREÇÃO (webhook): persistir o ID da cobrança HOSPEDADA (bill_*).
        // O webhook `billing.paid` do AbacatePay referencia esse ID, não o
        // pix_char_* do QR Code. Antes era `null`, então o webhook nunca
        // encontrava o pagamento e o status ficava preso em PENDING.
        gatewayBillingId: billing.gatewayBillingId ?? null,
        userId,
        amount: amountCheck.amount,
        status: 'PENDING',
        paidAt: null,
        createdAt: nowTs(),
      })

      // createEscrowForPayment só escreve (tx.set) — compatível com a regra do
      // Firestore de "leituras antes de escritas" nesta transação.
      const escrowRecord = createEscrowForPayment(tx, {
        paymentId: paymentRef.id,
        payerId: userId,
        payeeId,
        amount: amountCheck.amount,
        actorId: userId,
      })

      return { payment: { id: paymentRef.id }, escrow: escrowRecord }
    })

    return res.status(201).json({
      billingId: billing.billingId,
      pixCode: billing.pixCode,
      qrCodeBase64: billing.qrCodeBase64,
      checkoutUrl: billing.checkoutUrl,
      status: billing.status,
      gatewayBillingId: billing.gatewayBillingId ?? null,
      expiresAt: billing.expiresAt ?? null,
      devMode: billing.devMode ?? false,
      escrowId: escrow.id,
      escrowStatus: escrow.status,
      paymentId: payment.id,
      chargeRequestId: chargeRequest?.id ?? null,
    })
  } catch (err) {
    logger.error('payment:initiate_failed', { error: err.message, stack: err.stack, userId: req.userId, endpoint: req.originalUrl })
    return res.status(500).json({ msg: 'Erro interno ao iniciar pagamento.' })
  }
}

export const pollBillingStatus = async (req, res) => {
  // CORREÇÃO (304): status de pagamento é volátil e precisa ser sempre fresco.
  // Sem isso, o ETag do Express devolve 304 Not Modified enquanto o corpo não
  // muda, e o frontend fica "vendo" o estado PENDING antigo no polling.
  res.set('Cache-Control', 'no-store')
  try {
    const { billingId } = req.params

    const payment = await paymentRepo.getByBillingId(billingId)

    if (!payment) {
      return res.status(404).json({ msg: 'Pagamento não encontrado.' })
    }

    if (payment.userId !== req.userId) {
      return res.status(403).json({ msg: 'Acesso negado.' })
    }

    const escrow = await getEscrowByPaymentId(payment.id)

    // Se já estiver pago no nosso banco, responde direto
    if (payment.status === 'PAID') {
      return res.status(200).json({
        status: 'PAID',
        paidAt: payment.paidAt,
        escrowStatus: escrow?.status ?? null,
        escrowId: escrow?.id ?? null,
        expiresAt: null,
      })
    }

    let billing;
    try {
      billing = await getBillingStatus(billingId);
    } catch (apiError) {
      logger.warn('payment:status_gateway_unavailable', { billingId, error: apiError.message });
      // Degradação graciosa: Se a API falhar ou der timeout, mantemos o status atual (PENDING)
      return res.status(200).json({
        status: payment.status,
        paidAt: payment.paidAt,
        escrowStatus: escrow?.status ?? null,
        escrowId: escrow?.id ?? null,
        expiresAt: null,
      });
    }

    const gatewayStatus = normalizeGatewayStatus(billing.status);

    if (gatewayStatus !== payment.status) {
      await paymentRepo.setStatusByBillingId(billingId, gatewayStatus)

      if (gatewayStatus === 'PAID') {
        await holdEscrowFunds(payment.id)
        await markChargePaidForPayment(payment.id)
      }
    }

    const fresh = await paymentRepo.getByBillingId(billingId)
    const freshEscrow = await getEscrowByPaymentId(fresh.id)

    return res.status(200).json({
      status: fresh.status,
      paidAt: fresh.paidAt,
      escrowStatus: freshEscrow?.status ?? null,
      escrowId: freshEscrow?.id ?? null,
      expiresAt: billing.expiresAt ?? null,
    })
  } catch (err) {
    logger.error('payment:poll_failed', { error: err.message, stack: err.stack, userId: req.userId, endpoint: req.originalUrl })
    return res.status(500).json({ msg: 'Erro ao consultar status.' })
  }
}