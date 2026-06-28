import { db } from '../lib/firestore.js'
import { mapDoc, mapQuery, nowTs } from './_helpers.js'

/**
 * chargeRequestRepository — coleção `chargeRequests` (substitui
 * prisma.chargeRequest.*). Consultas filtram por um campo indexado
 * automaticamente (ex.: caregiverId) e refinam o resto em memória, evitando
 * índices compostos para o volume do MVP.
 */

const col = () => db.collection('chargeRequests')

export async function getById(id) {
  if (!id) return null
  return mapDoc(await col().doc(id).get())
}

export async function create(data) {
  const ref = col().doc()
  const now = nowTs()
  await ref.set({
    caregiverId: data.caregiverId,
    familiarId: data.familiarId,
    baseAmount: data.baseAmount,
    totalAmount: data.totalAmount,
    description: data.description ?? null,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  })
  return getById(ref.id)
}

/** Cancela cobranças PENDING do par cuidador→familiar (antes de criar nova). */
export async function cancelPendingForPair(caregiverId, familiarId) {
  const snap = await col().where('caregiverId', '==', caregiverId).get()
  const targets = snap.docs.filter((d) => {
    const c = d.data()
    return c.status === 'PENDING' && c.familiarId === familiarId
  })
  await Promise.all(
    targets.map((d) => d.ref.update({ status: 'CANCELLED', updatedAt: nowTs() }))
  )
}

/** Cobrança PENDING entre dois usuários (qualquer direção), mais recente. */
export async function findPendingBetween(userId, peerId) {
  const [asCaregiver, peerAsCaregiver] = await Promise.all([
    col().where('caregiverId', '==', userId).get(),
    col().where('caregiverId', '==', peerId).get(),
  ])

  const candidates = []
  asCaregiver.docs.forEach((d) => {
    const c = mapDoc(d)
    if (c.status === 'PENDING' && c.familiarId === peerId) candidates.push(c)
  })
  peerAsCaregiver.docs.forEach((d) => {
    const c = mapDoc(d)
    if (c.status === 'PENDING' && c.familiarId === userId) candidates.push(c)
  })

  candidates.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))
  return candidates[0] ?? null
}

/** Marca como PAID se ainda estiver PENDING (idempotente). */
export async function markPaidById(chargeRequestId) {
  if (!chargeRequestId) return
  const ref = col().doc(chargeRequestId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists && snap.data().status === 'PENDING') {
      tx.update(ref, { status: 'PAID', updatedAt: nowTs() })
    }
  })
}

/** Marca cobrança PENDING que casa com (familiar, cuidador, valor total) como PAID. */
export async function markPaidForTriple(familiarId, caregiverId, totalAmount) {
  const snap = await col().where('caregiverId', '==', caregiverId).get()
  const targets = snap.docs.filter((d) => {
    const c = d.data()
    return c.status === 'PENDING' && c.familiarId === familiarId && c.totalAmount === totalAmount
  })
  await Promise.all(
    targets.map((d) => d.ref.update({ status: 'PAID', updatedAt: nowTs() }))
  )
}
