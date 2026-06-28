import { db } from '../lib/firestore.js'
import { mapDoc, nowTs, toTimestamp } from '../repositories/_helpers.js'
import {
  escrowsCol,
  idempotencyCol,
  auditCol,
  getById as getEscrowById,
  getByPaymentId as getEscrowByPaymentId,
  getAuditTrail as getAuditTrailDocs,
} from '../repositories/escrowRepository.js'
import { paymentsCol } from '../repositories/paymentRepository.js'
import { logger } from '../lib/logger.js'
import { assertEscrowTransition, isTerminalEscrowStatus } from './escrowStateMachine.js'
import { validateAmountCents, validateIdempotencyKey } from '../utils/validation.js'

/**
 * escrowService — custódia (escrow) sobre Firestore. As transições de estado
 * usam `db.runTransaction`: a leitura dentro da transação trava o documento e
 * o `tx.update` só comita se a versão lida não mudou — equivalente ao
 * `updateMany` condicional do Prisma (compare-and-set anti-race).
 *
 * A trilha de auditoria fica em `escrows/{id}/auditLogs` e é escrita na MESMA
 * transação da transição. A idempotência usa a própria chave como ID do
 * documento em `escrowIdempotencyKeys`, garantindo unicidade via `tx.set`/get.
 */

/** Escreve um registro de auditoria dentro da transação. */
function writeAuditLog(tx, escrowId, { fromStatus, toStatus, actorId = null, reason = null, metadata = null }) {
  tx.set(auditCol(escrowId).doc(), {
    escrowId,
    fromStatus,
    toStatus,
    actorId,
    reason,
    metadata: metadata ?? null,
    createdAt: nowTs(),
  })
}

/**
 * Cria a custódia vinculada ao pagamento (PENDING). Recebe a transação do
 * Firestore — é chamada dentro da mesma transação que cria o Payment.
 */
export function createEscrowForPayment(tx, { paymentId, payerId, payeeId, amount, actorId }) {
  const amountCheck = validateAmountCents(amount)
  if (!amountCheck.valid) {
    throw new Error(amountCheck.error)
  }

  const escrowRef = escrowsCol().doc()
  const when = nowTs()

  tx.set(escrowRef, {
    paymentId,
    payerId,
    payeeId: payeeId ?? null,
    amount: amountCheck.amount,
    status: 'PENDING',
    heldAt: null,
    disputedAt: null,
    releasedAt: null,
    createdAt: when,
    updatedAt: when,
  })

  writeAuditLog(tx, escrowRef.id, {
    fromStatus: null,
    toStatus: 'PENDING',
    actorId,
    reason: 'Custódia criada — aguardando confirmação PIX',
    metadata: { paymentId, amount: amountCheck.amount },
  })

  return {
    id: escrowRef.id,
    paymentId,
    payerId,
    payeeId: payeeId ?? null,
    amount: amountCheck.amount,
    status: 'PENDING',
  }
}

/**
 * Transição atômica PENDING → HELD após confirmação do gateway (webhook/poll).
 */
export async function holdEscrowFunds(paymentId, actorId = null) {
  const found = await getEscrowByPaymentId(paymentId)
  if (!found) {
    return { updated: false, reason: 'NO_ESCROW' }
  }

  const escrowRef = escrowsCol().doc(found.id)
  const paymentRef = paymentsCol().doc(paymentId)

  return db.runTransaction(async (tx) => {
    const escrowSnap = await tx.get(escrowRef)
    const paymentSnap = await tx.get(paymentRef)

    if (!escrowSnap.exists) {
      return { updated: false, reason: 'NO_ESCROW' }
    }
    const escrow = mapDoc(escrowSnap)

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

    const payment = mapDoc(paymentSnap)
    if (!payment || payment.status !== 'PAID') {
      return { updated: false, reason: 'PAYMENT_NOT_PAID', escrow }
    }
    if (escrow.status !== 'PENDING') {
      return { updated: false, reason: 'RACE_LOST', escrow }
    }

    const when = new Date()
    tx.update(escrowRef, { status: 'HELD', heldAt: toTimestamp(when), updatedAt: nowTs() })
    writeAuditLog(tx, escrow.id, {
      fromStatus: 'PENDING',
      toStatus: 'HELD',
      actorId,
      reason: 'Fundos retidos em custódia após confirmação do PIX',
      metadata: { billingId: payment.billingId },
    })

    return { updated: true, escrow: { ...escrow, status: 'HELD', heldAt: when } }
  })
}

/**
 * Executa transição (RELEASE/DISPUTE) com idempotência e compare-and-set.
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

  const escrowRef = escrowsCol().doc(escrowId)
  const idempRef = idempotencyCol().doc(keyCheck.key)

  const result = await db.runTransaction(async (tx) => {
    const escrowSnap = await tx.get(escrowRef)
    if (!escrowSnap.exists) {
      const err = new Error('Custódia não encontrada.')
      err.statusCode = 404
      throw err
    }
    const escrow = mapDoc(escrowSnap)

    const paymentSnap = await tx.get(paymentsCol().doc(escrow.paymentId))
    const idempSnap = await tx.get(idempRef)

    // Resposta cacheada: requisição repetida com a mesma chave.
    if (idempSnap.exists) {
      const rec = idempSnap.data()
      if (rec.escrowId !== escrowId || rec.operation !== operation) {
        const err = new Error('Idempotency-Key já utilizada em outra operação.')
        err.statusCode = 409
        throw err
      }
      return { idempotent: true, body: rec.response }
    }

    authorize(escrow)

    const payment = mapDoc(paymentSnap)
    if (!payment || escrow.amount !== payment.amount) {
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
      // Já no estado-alvo → tratada como aplicação anterior (idempotente).
      if (escrow.status === targetStatus) {
        return {
          idempotent: false,
          body: { escrowId, status: escrow.status, message: 'Transição já aplicada.' },
        }
      }
      const err = new Error(`Operação não permitida no estado "${escrow.status}".`)
      err.statusCode = 409
      throw err
    }

    const when = new Date()
    const dataPatch =
      targetStatus === 'RELEASED'
        ? { status: 'RELEASED', releasedAt: toTimestamp(when) }
        : { status: 'DISPUTED', disputedAt: toTimestamp(when) }

    tx.update(escrowRef, { ...dataPatch, updatedAt: nowTs() })
    writeAuditLog(tx, escrowId, {
      fromStatus: escrow.status,
      toStatus: targetStatus,
      actorId,
      reason,
      metadata: { operation, idempotencyKey: keyCheck.key },
    })

    const body = {
      escrowId,
      status: targetStatus,
      amount: escrow.amount,
      payeeId: escrow.payeeId,
      releasedAt: targetStatus === 'RELEASED' ? when : null,
      disputedAt: targetStatus === 'DISPUTED' ? when : null,
    }

    tx.set(idempRef, {
      key: keyCheck.key,
      operation,
      escrowId,
      actorId,
      resultStatus: targetStatus,
      response: body,
      createdAt: nowTs(),
    })

    return { idempotent: false, body }
  })

  logger.info('escrow:transition', { operation, escrowId, actorId, targetStatus })
  return result
}

/** Libera fundos ao cuidador (HELD ou DISPUTED → RELEASED). Idempotente. */
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

/** Abre disputa (HELD → DISPUTED). Idempotente. */
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

/** Lista a trilha de auditoria de uma custódia (participantes apenas). */
export async function getEscrowAuditTrail(escrowId, actorId) {
  const escrow = await getEscrowById(escrowId)
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
  return getAuditTrailDocs(escrowId)
}
