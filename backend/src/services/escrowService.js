import prisma from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { assertEscrowTransition, isTerminalEscrowStatus } from './escrowStateMachine.js'
import { validateAmountCents, validateIdempotencyKey } from '../utils/validation.js'

/**
 * Registra transição na trilha de auditoria (append-only).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function writeAuditLog(tx, {
  escrowId,
  fromStatus,
  toStatus,
  actorId = null,
  reason = null,
  metadata = null,
}) {
  return tx.escrowAuditLog.create({
    data: {
      escrowId,
      fromStatus,
      toStatus,
      actorId,
      reason,
      metadata: metadata ?? undefined,
    },
  })
}

/**
 * Consulta registro idempotente — retorna resposta cacheada se a chave já foi usada.
 * @param {string} idempotencyKey
 */
async function findIdempotentResponse(idempotencyKey) {
  const record = await prisma.escrowIdempotencyKey.findUnique({
    where: { key: idempotencyKey },
  })
  if (!record?.response) return null
  return { record, body: record.response }
}

/**
 * Cria custódia vinculada ao pagamento (estado inicial PENDING).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function createEscrowForPayment(tx, {
  paymentId,
  payerId,
  payeeId,
  amount,
  actorId,
}) {
  const amountCheck = validateAmountCents(amount)
  if (!amountCheck.valid) {
    throw new Error(amountCheck.error)
  }

  const escrow = await tx.escrow.create({
    data: {
      paymentId,
      payerId,
      payeeId: payeeId ?? null,
      amount: amountCheck.amount,
      status: 'PENDING',
    },
  })

  await writeAuditLog(tx, {
    escrowId: escrow.id,
    fromStatus: null,
    toStatus: 'PENDING',
    actorId,
    reason: 'Custódia criada — aguardando confirmação PIX',
    metadata: { paymentId, amount: amountCheck.amount },
  })

  return escrow
}

/**
 * Transição atômica PENDING → HELD após confirmação do gateway (webhook).
 * Usa updateMany condicional para evitar race entre workers concorrentes.
 *
 * @param {string} paymentId
 * @param {string} [actorId]
 */
export async function holdEscrowFunds(paymentId, actorId = null) {
  return prisma.$transaction(async (tx) => {
    const escrow = await tx.escrow.findUnique({
      where: { paymentId },
      include: { payment: true },
    })

    if (!escrow) {
      return { updated: false, reason: 'NO_ESCROW' }
    }

    if (escrow.status === 'HELD') {
      return { updated: false, reason: 'ALREADY_HELD', escrow }
    }

    if (isTerminalEscrowStatus(escrow.status)) {
      return { updated: false, reason: 'TERMINAL', escrow }
    }

    const transition = assertEscrowTransition(escrow.status, 'HELD')
    if (!transition.allowed) {
      return { updated: false, reason: transition.error, escrow }
    }

    if (escrow.payment.status !== 'PAID') {
      return { updated: false, reason: 'PAYMENT_NOT_PAID', escrow }
    }

    const result = await tx.escrow.updateMany({
      where: { id: escrow.id, status: 'PENDING' },
      data: { status: 'HELD', heldAt: new Date() },
    })

    if (result.count === 0) {
      const current = await tx.escrow.findUnique({ where: { id: escrow.id } })
      return { updated: false, reason: 'RACE_LOST', escrow: current }
    }

    await writeAuditLog(tx, {
      escrowId: escrow.id,
      fromStatus: 'PENDING',
      toStatus: 'HELD',
      actorId,
      reason: 'Fundos retidos em custódia após confirmação do PIX',
      metadata: { billingId: escrow.payment.billingId },
    })

    const updated = await tx.escrow.findUnique({ where: { id: escrow.id } })
    return { updated: true, escrow: updated }
  })
}

/**
 * Executa transição com idempotência e updateMany condicional (anti race).
 *
 * @param {{
 *   escrowId: string
 *   actorId: string
 *   idempotencyKey: string
 *   operation: 'RELEASE' | 'DISPUTE'
 *   targetStatus: 'RELEASED' | 'DISPUTED'
 *   fromStatuses: string[]
 *   reason: string
 *   authorize: (escrow: object) => void
 * }} params
 */
async function transitionEscrowWithIdempotency({
  escrowId,
  actorId,
  idempotencyKey,
  operation,
  targetStatus,
  fromStatuses,
  reason,
  authorize,
}) {
  const keyCheck = validateIdempotencyKey(idempotencyKey)
  if (!keyCheck.valid) {
    const err = new Error(keyCheck.error)
    err.statusCode = 422
    throw err
  }

  const cached = await findIdempotentResponse(keyCheck.key)
  if (cached) {
    if (cached.record.escrowId !== escrowId || cached.record.operation !== operation) {
      const err = new Error('Idempotency-Key já utilizada em outra operação.')
      err.statusCode = 409
      throw err
    }
    return { idempotent: true, body: cached.body }
  }

  const result = await prisma.$transaction(async (tx) => {
    const escrow = await tx.escrow.findUnique({
      where: { id: escrowId },
      include: { payment: true },
    })

    if (!escrow) {
      const err = new Error('Custódia não encontrada.')
      err.statusCode = 404
      throw err
    }

    authorize(escrow)

    if (escrow.amount !== escrow.payment.amount) {
      const err = new Error('Inconsistência de valor entre pagamento e custódia.')
      err.statusCode = 409
      throw err
    }

    const transition = assertEscrowTransition(escrow.status, targetStatus)
    if (!transition.allowed) {
      const err = new Error(transition.error)
      err.statusCode = 409
      throw err
    }

    if (!fromStatuses.includes(escrow.status)) {
      const err = new Error(`Operação não permitida no estado "${escrow.status}".`)
      err.statusCode = 409
      throw err
    }

    const dataPatch =
      targetStatus === 'RELEASED'
        ? { status: 'RELEASED', releasedAt: new Date() }
        : { status: 'DISPUTED', disputedAt: new Date() }

    const updated = await tx.escrow.updateMany({
      where: { id: escrowId, status: { in: fromStatuses } },
      data: dataPatch,
    })

    if (updated.count === 0) {
      const current = await tx.escrow.findUnique({ where: { id: escrowId } })
      if (current?.status === targetStatus) {
        const body = {
          escrowId: current.id,
          status: current.status,
          message: 'Transição já aplicada.',
        }
        return { body, escrow: current, fromStatus: current.status }
      }
      const err = new Error('Conflito de concorrência — tente novamente.')
      err.statusCode = 409
      throw err
    }

    const fromStatus = escrow.status

    await writeAuditLog(tx, {
      escrowId,
      fromStatus,
      toStatus: targetStatus,
      actorId,
      reason,
      metadata: { operation, idempotencyKey: keyCheck.key },
    })

    const fresh = await tx.escrow.findUnique({ where: { id: escrowId } })

    const body = {
      escrowId: fresh.id,
      status: fresh.status,
      amount: fresh.amount,
      payeeId: fresh.payeeId,
      releasedAt: fresh.releasedAt,
      disputedAt: fresh.disputedAt,
    }

    await tx.escrowIdempotencyKey.create({
      data: {
        key: keyCheck.key,
        operation,
        escrowId,
        actorId,
        resultStatus: targetStatus,
        response: body,
      },
    })

    return { body, escrow: fresh, fromStatus }
  })

  logger.info('escrow:transition', { operation, escrowId, actorId, targetStatus })

  return { idempotent: false, body: result.body }
}

/**
 * Libera fundos ao cuidador (HELD ou DISPUTED → RELEASED).
 * Exige Idempotency-Key — requisições duplicadas retornam o mesmo resultado.
 *
 * @param {string} escrowId
 * @param {string} actorId - deve ser o payer (familiar)
 * @param {string} idempotencyKey
 */
export async function releaseEscrowFunds(escrowId, actorId, idempotencyKey) {
  return transitionEscrowWithIdempotency({
    escrowId,
    actorId,
    idempotencyKey,
    operation: 'RELEASE',
    targetStatus: 'RELEASED',
    fromStatuses: ['HELD', 'DISPUTED'],
    reason: 'Fundos liberados após aprovação do atendimento',
    authorize: (escrow) => {
      if (escrow.payerId !== actorId) {
        const err = new Error('Apenas o pagador pode liberar os fundos.')
        err.statusCode = 403
        throw err
      }
      if (!escrow.payeeId) {
        const err = new Error('Custódia sem cuidador definido — liberação bloqueada.')
        err.statusCode = 422
        throw err
      }
    },
  })
}

/**
 * Abre disputa (HELD → DISPUTED). Idempotente.
 */
export async function disputeEscrowFunds(escrowId, actorId, idempotencyKey, disputeReason = '') {
  return transitionEscrowWithIdempotency({
    escrowId,
    actorId,
    idempotencyKey,
    operation: 'DISPUTE',
    targetStatus: 'DISPUTED',
    fromStatuses: ['HELD'],
    reason: disputeReason || 'Disputa aberta pelo participante',
    authorize: (escrow) => {
      const isParty = escrow.payerId === actorId || escrow.payeeId === actorId
      if (!isParty) {
        const err = new Error('Apenas participantes da custódia podem abrir disputa.')
        err.statusCode = 403
        throw err
      }
    },
  })
}

/**
 * Lista trilha de auditoria de uma custódia (participantes apenas).
 */
export async function getEscrowAuditTrail(escrowId, actorId) {
  const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } })
  if (!escrow) {
    const err = new Error('Custódia não encontrada.')
    err.statusCode = 404
    throw err
  }
  const isParty = escrow.payerId === actorId || escrow.payeeId === actorId
  if (!isParty) {
    const err = new Error('Acesso negado.')
    err.statusCode = 403
    throw err
  }
  return prisma.escrowAuditLog.findMany({
    where: { escrowId },
    orderBy: { createdAt: 'asc' },
  })
}
