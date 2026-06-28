import { logger } from '../lib/logger.js'
import { isValidObjectId } from '../utils/validation.js'
import { getById as getEscrowById } from '../repositories/escrowRepository.js'
import { getById as getPaymentById } from '../repositories/paymentRepository.js'
import {
  releaseEscrowFunds,
  disputeEscrowFunds,
  getEscrowAuditTrail,
} from '../services/escrowService.js'

function readIdempotencyKey(req) {
  return req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'] ?? ''
}

function handleServiceError(res, err) {
  const status = err.statusCode ?? 500
  if (status >= 500) {
    logger.error('escrow:operation_failed', { error: err.message, stack: err.stack })
  }
  return res.status(status).json({ msg: err.message })
}

/**
 * GET /escrow/:escrowId — detalhes da custódia (participantes).
 */
export const getEscrow = async (req, res) => {
  try {
    const { escrowId } = req.params
    if (!isValidObjectId(escrowId)) {
      return res.status(422).json({ msg: 'ID de custódia inválido.' })
    }

    const escrow = await getEscrowById(escrowId)

    if (!escrow) {
      return res.status(404).json({ msg: 'Custódia não encontrada.' })
    }

    const isParty =
      escrow.payerId === req.userId || escrow.payeeId === req.userId
    if (!isParty) {
      return res.status(403).json({ msg: 'Acesso negado.' })
    }

    // Substitui o include do Prisma: busca o pagamento vinculado.
    const paymentDoc = await getPaymentById(escrow.paymentId)
    const payment = paymentDoc
      ? { billingId: paymentDoc.billingId, status: paymentDoc.status, paidAt: paymentDoc.paidAt }
      : null

    return res.status(200).json({
      id: escrow.id,
      status: escrow.status,
      amount: escrow.amount,
      payerId: escrow.payerId,
      payeeId: escrow.payeeId,
      heldAt: escrow.heldAt,
      disputedAt: escrow.disputedAt,
      releasedAt: escrow.releasedAt,
      payment,
    })
  } catch (err) {
    return handleServiceError(res, err)
  }
}

/**
 * POST /escrow/:escrowId/release
 * Header: Idempotency-Key (obrigatório)
 */
export const releaseFunds = async (req, res) => {
  try {
    const { escrowId } = req.params
    if (!isValidObjectId(escrowId)) {
      return res.status(422).json({ msg: 'ID de custódia inválido.' })
    }

    const result = await releaseEscrowFunds(
      escrowId,
      req.userId,
      readIdempotencyKey(req),
    )

    return res.status(200).json({
      ...result.body,
      idempotentReplay: result.idempotent,
    })
  } catch (err) {
    return handleServiceError(res, err)
  }
}

/**
 * POST /escrow/:escrowId/dispute
 * Header: Idempotency-Key (obrigatório)
 * Body: { reason?: string }
 */
export const openDispute = async (req, res) => {
  try {
    const { escrowId } = req.params
    if (!isValidObjectId(escrowId)) {
      return res.status(422).json({ msg: 'ID de custódia inválido.' })
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : ''

    const result = await disputeEscrowFunds(
      escrowId,
      req.userId,
      readIdempotencyKey(req),
      reason,
    )

    return res.status(200).json({
      ...result.body,
      idempotentReplay: result.idempotent,
    })
  } catch (err) {
    return handleServiceError(res, err)
  }
}

/**
 * GET /escrow/:escrowId/audit — trilha de auditoria.
 */
export const getAuditTrail = async (req, res) => {
  try {
    const { escrowId } = req.params
    if (!isValidObjectId(escrowId)) {
      return res.status(422).json({ msg: 'ID de custódia inválido.' })
    }

    const logs = await getEscrowAuditTrail(escrowId, req.userId)
    return res.status(200).json({ logs })
  } catch (err) {
    return handleServiceError(res, err)
  }
}
