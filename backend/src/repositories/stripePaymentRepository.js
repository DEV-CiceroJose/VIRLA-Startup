import { db } from '../lib/firestore.js'
import { mapDoc, nowTs, toTimestamp } from './_helpers.js'

const col = () => db.collection('stripePayments')

export async function getByReportId(reportId) {
  if (!reportId) return null
  return mapDoc(await col().doc(reportId).get())
}

export async function getByCheckoutSessionId(sessionId) {
  if (!sessionId) return null
  const snap = await col().where('checkoutSessionId', '==', sessionId).limit(1).get()
  return snap.empty ? null : mapDoc(snap.docs[0])
}

export async function saveCheckout({ report, session, connectedAccountId, attempt }) {
  await col().doc(report.id).set({
    reportId: report.id,
    familiarId: report.familiarId,
    caregiverId: report.caregiverId,
    stripeAccountId: connectedAccountId,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    amount: report.totalAmount,
    caregiverAmount: report.baseAmount,
    platformFeeAmount: report.totalAmount - report.baseAmount,
    currency: 'brl',
    status: session.payment_status === 'paid' ? 'PAID' : 'OPEN',
    attempt,
    paidAt: session.payment_status === 'paid' ? nowTs() : null,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  }, { merge: true })
  return getByReportId(report.id)
}

export async function updateStatusByReportId(reportId, status, patch = {}) {
  await col().doc(reportId).update({
    status,
    ...patch,
    ...(patch.paidAt && { paidAt: toTimestamp(patch.paidAt) }),
    updatedAt: nowTs(),
  })
  return getByReportId(reportId)
}
