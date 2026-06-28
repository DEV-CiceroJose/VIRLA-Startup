import prisma from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { holdEscrowFunds } from './escrowService.js'
import { markChargePaidForPayment } from './chargeRequestService.js'

const PAID_EVENT_TYPES = new Set([
  'BILLING.PAID',
  'billing.paid',
  'PAID',
  'checkout.completed',
  'transparent.completed',
  'pix.paid',
  'PIX.PAID',
])

/** Extrai o ID da cobrança (bill_*, pix_char_*, char_*, etc.) do payload do webhook. */
function extractBillingId(event) {
  const data = event?.data ?? event
  return (
    data?.id ??
    data?.transparent?.id ??
    data?.billing?.id ??
    data?.checkout?.id ??
    data?.metadata?.virlaBillingId ??
    event?.billing?.id ??
    null
  )
}

/**
 * Processa evento do AbacatePay de forma síncrona (antes do HTTP 200).
 * Separa reconciliação de pagamento (DB) da custódia (HELD).
 *
 * @param {object} event - payload JSON do webhook
 * @returns {Promise<{ handled: boolean; billingId?: string }>}
 */
export async function processPaymentEvent(event) {
  const eventType = event?.event ?? event?.type ?? ''
  const billingId = extractBillingId(event)

  // Detecta pagamento por NOME do evento OU pelo STATUS no payload.
  // Fallback de status evita falso positivo de sucesso (HTTP 200 sem ação)
  // quando o AbacatePay envia um nome de evento fora da lista conhecida.
  const data = event?.data ?? event
  const statusPaid =
    String(data?.status ?? data?.billing?.status ?? data?.pixQrCode?.status ?? '')
      .toUpperCase() === 'PAID'

  if (!PAID_EVENT_TYPES.has(eventType) && !statusPaid) {
    logger.info('webhook:event_ignored', { eventType })
    return { handled: false }
  }

  if (!billingId || typeof billingId !== 'string') {
    logger.error('webhook:paid_without_billing_id', { eventType })
    return { handled: false }
  }

  const paymentResult = await prisma.payment.updateMany({
    where: {
      status: { not: 'PAID' },
      OR: [{ billingId }, { gatewayBillingId: billingId }],
    },
    data: { status: 'PAID', paidAt: new Date() },
  })

  if (paymentResult.count === 0) {
    const existing = await prisma.payment.findFirst({
      where: { OR: [{ billingId }, { gatewayBillingId: billingId }] },
    })
    if (!existing) {
      logger.error('webhook:payment_not_found', { billingId })
      return { handled: false, billingId }
    }
    logger.info('webhook:payment_already_paid', { billingId })
  } else {
    logger.info('webhook:payment_marked_paid', { billingId })
  }

  const payment = await prisma.payment.findFirst({
    where: { OR: [{ billingId }, { gatewayBillingId: billingId }] },
    include: { escrow: true },
  })

  if (!payment?.escrow) {
    logger.warn('webhook:no_escrow_for_billing', { billingId })
    return { handled: true, billingId }
  }

  await markChargePaidForPayment(payment.id)

  const holdResult = await holdEscrowFunds(payment.id)

  if (holdResult.updated) {
    logger.info('webhook:escrow_held', { escrowId: holdResult.escrow.id, billingId })
  } else {
    logger.info('webhook:escrow_hold_skipped', { reason: holdResult.reason, billingId })
  }

  return { handled: true, billingId }
}
