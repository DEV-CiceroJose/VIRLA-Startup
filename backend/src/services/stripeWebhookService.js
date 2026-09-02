import * as reportRepo from '../repositories/serviceReportRepository.js'
import * as paymentRepo from '../repositories/stripePaymentRepository.js'
import { reverseDisputedTransfer } from './stripeService.js'
import { logger } from '../lib/logger.js'

function reportIdFrom(object) {
  return object?.metadata?.reportId ?? object?.client_reference_id ?? null
}

export async function processStripeEvent(event) {
  const object = event.data?.object
  const reportId = reportIdFrom(object)

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (!reportId || object.payment_status !== 'paid') return { handled: false }
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id
      await paymentRepo.updateStatusByReportId(reportId, 'PAID', { paymentIntentId, paidAt: new Date() })
      await reportRepo.markPaid(reportId, { paymentIntentId })
      logger.info('stripe:payment_paid', { eventId: event.id, reportId, paymentIntentId })
      return { handled: true, reportId }
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      if (!reportId) return { handled: false }
      await paymentRepo.updateStatusByReportId(reportId, event.type.endsWith('expired') ? 'EXPIRED' : 'FAILED')
      await reportRepo.markPaymentStatus(reportId, 'SIGNED')
      return { handled: true, reportId }
    }
    case 'charge.refunded': {
      const id = reportIdFrom(object)
      if (!id) return { handled: false }
      await paymentRepo.updateStatusByReportId(id, 'REFUNDED')
      await reportRepo.markPaymentStatus(id, 'REFUNDED')
      return { handled: true, reportId: id }
    }
    case 'charge.dispute.created': {
      const result = await reverseDisputedTransfer(object)
      const chargeReportId = result.reportId || null
      if (chargeReportId) {
        await paymentRepo.updateStatusByReportId(chargeReportId, 'DISPUTED', { disputeId: object.id })
        await reportRepo.markPaymentStatus(chargeReportId, 'DISPUTED')
      }
      return { handled: true, reportId: chargeReportId, reversed: result.reversed }
    }
    default:
      return { handled: false }
  }
}
