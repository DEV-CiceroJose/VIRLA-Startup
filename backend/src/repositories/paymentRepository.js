import { db } from '../lib/firestore.js'
import { mapDoc, nowTs } from './_helpers.js'

/**
 * paymentRepository — coleção `payments` (substitui prisma.payment.*).
 *
 * `billingId` é único; usamos consulta por igualdade (índice de campo único
 * automático). O `OR: [billingId, gatewayBillingId]` do webhook vira duas
 * consultas sequenciais.
 */

export const paymentsCol = () => db.collection('payments')

export async function getById(id) {
  if (!id) return null
  return mapDoc(await paymentsCol().doc(id).get())
}

export async function getByBillingId(billingId) {
  if (!billingId) return null
  const snap = await paymentsCol().where('billingId', '==', billingId).limit(1).get()
  return snap.empty ? null : mapDoc(snap.docs[0])
}

/** Cobre o `OR: [{billingId}, {gatewayBillingId}]` do webhook/poll. */
export async function findByEitherBillingId(billingId) {
  if (!billingId) return null
  const byBilling = await getByBillingId(billingId)
  if (byBilling) return byBilling
  const snap = await paymentsCol().where('gatewayBillingId', '==', billingId).limit(1).get()
  return snap.empty ? null : mapDoc(snap.docs[0])
}

/**
 * Marca como PAID (com compare-and-set) o pagamento referenciado por billingId
 * ou gatewayBillingId. Retorna { changed, payment }.
 */
export async function markPaidByEitherBillingId(billingId) {
  const existing = await findByEitherBillingId(billingId)
  if (!existing) return { changed: false, payment: null }

  const ref = paymentsCol().doc(existing.id)
  const changed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return false
    if (snap.data().status === 'PAID') return false
    tx.update(ref, { status: 'PAID', paidAt: nowTs() })
    return true
  })
  return { changed, payment: await getById(existing.id) }
}

/** Atualiza o status do pagamento por billingId (usado no polling). */
export async function setStatusByBillingId(billingId, status) {
  const existing = await getByBillingId(billingId)
  if (!existing) return null
  await paymentsCol().doc(existing.id).update({
    status,
    paidAt: status === 'PAID' ? nowTs() : null,
  })
  return getById(existing.id)
}
