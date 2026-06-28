import { db } from '../lib/firestore.js'
import { mapDoc, mapQuery } from './_helpers.js'

/**
 * escrowRepository — acesso à coleção `escrows`, à subcoleção de auditoria
 * `escrows/{id}/auditLogs` e à coleção `escrowIdempotencyKeys`.
 *
 * A lógica transacional (compare-and-set, idempotência) fica em escrowService,
 * que usa estas coleções dentro de `db.runTransaction`.
 */

export const escrowsCol = () => db.collection('escrows')
export const idempotencyCol = () => db.collection('escrowIdempotencyKeys')
export const auditCol = (escrowId) => escrowsCol().doc(escrowId).collection('auditLogs')

export async function getById(id) {
  if (!id) return null
  return mapDoc(await escrowsCol().doc(id).get())
}

/** Custódia vinculada a um pagamento (relação 1:1 via campo paymentId). */
export async function getByPaymentId(paymentId) {
  if (!paymentId) return null
  const snap = await escrowsCol().where('paymentId', '==', paymentId).limit(1).get()
  return snap.empty ? null : mapDoc(snap.docs[0])
}

/** Trilha de auditoria (append-only), em ordem cronológica crescente. */
export async function getAuditTrail(escrowId) {
  const snap = await auditCol(escrowId).get()
  return mapQuery(snap).sort(
    (a, b) => (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0)
  )
}
