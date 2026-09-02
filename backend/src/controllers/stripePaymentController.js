import { getUserById } from '../repositories/userRepository.js'
import * as reportRepo from '../repositories/serviceReportRepository.js'
import * as stripePaymentRepo from '../repositories/stripePaymentRepository.js'
import {
  createCheckoutForSignedReport,
  getRecipientAccountStatus,
  getStripeClient,
  refundDestinationPayment,
} from '../services/stripeService.js'
import { assertCheckoutEligible, ServiceReportError } from '../services/serviceReportDomain.js'
import { logger } from '../lib/logger.js'

export async function createCheckoutSession(req, res) {
  try {
    const report = await reportRepo.getById(req.body.reportId)
    assertCheckoutEligible(report, req.userId)

    const existing = await stripePaymentRepo.getByReportId(report.id)
    if (existing?.status === 'PAID') {
      return res.status(409).json({ msg: 'Este relatório já foi pago.', status: 'PAID' })
    }
    if (existing?.checkoutSessionId && existing?.checkoutUrl && existing.status === 'OPEN') {
      const existingSession = await getStripeClient().checkout.sessions.retrieve(existing.checkoutSessionId)
      if (existingSession.status === 'open') {
        return res.status(200).json({ sessionId: existing.checkoutSessionId, url: existing.checkoutUrl, reused: true })
      }
    }

    const [familiar, caregiver] = await Promise.all([
      getUserById(report.familiarId),
      getUserById(report.caregiverId),
    ])
    if (!caregiver?.stripeAccountId) {
      return res.status(409).json({ msg: 'O cuidador ainda não concluiu o cadastro para receber pagamentos.' })
    }
    const readiness = await getRecipientAccountStatus(caregiver.stripeAccountId)
    if (!readiness.ready) {
      return res.status(409).json({
        msg: 'O cadastro de recebimento do cuidador ainda está em análise ou incompleto.',
        code: 'CAREGIVER_PAYOUT_NOT_READY',
      })
    }

    const attempt = (existing?.attempt ?? 0) + 1
    const session = await createCheckoutForSignedReport({
      report,
      familiar,
      connectedAccountId: caregiver.stripeAccountId,
      attempt,
    })
    await stripePaymentRepo.saveCheckout({ report, session, connectedAccountId: caregiver.stripeAccountId, attempt })
    await reportRepo.attachCheckout(report.id, session)
    return res.status(201).json({ sessionId: session.id, url: session.url, reused: false })
  } catch (err) {
    if (err instanceof ServiceReportError) {
      return res.status(err.statusCode).json({ msg: err.message, code: err.code })
    }
    logger.error('stripe:checkout_create_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(err.statusCode ?? 502).json({ msg: 'Não foi possível iniciar o pagamento pela Stripe.' })
  }
}

export async function getCheckoutStatus(req, res) {
  res.set('Cache-Control', 'no-store')
  try {
    const payment = await stripePaymentRepo.getByCheckoutSessionId(req.params.sessionId)
    if (!payment) return res.status(404).json({ msg: 'Pagamento não encontrado.' })
    if (payment.familiarId !== req.userId) return res.status(403).json({ msg: 'Acesso negado.' })

    if (!['PAID', 'REFUNDED', 'DISPUTED'].includes(payment.status)) {
      const session = await getStripeClient().checkout.sessions.retrieve(payment.checkoutSessionId)
      if (session.payment_status === 'paid') {
        await stripePaymentRepo.updateStatusByReportId(payment.reportId, 'PAID', {
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          paidAt: new Date(),
        })
        await reportRepo.markPaid(payment.reportId, {
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        })
      }
    }

    const fresh = await stripePaymentRepo.getByReportId(payment.reportId)
    return res.status(200).json({
      status: fresh.status,
      amount: fresh.amount,
      paidAt: fresh.paidAt,
      reportId: fresh.reportId,
      paymentIntentId: fresh.paymentIntentId ?? null,
    })
  } catch (err) {
    logger.error('stripe:checkout_status_failed', { error: err.message, userId: req.userId })
    return res.status(err.statusCode ?? 502).json({ msg: 'Não foi possível consultar o pagamento.' })
  }
}

export async function refundStripePayment(req, res) {
  try {
    const payment = await stripePaymentRepo.getByReportId(req.params.reportId)
    if (!payment) return res.status(404).json({ msg: 'Pagamento não encontrado.' })
    if (payment.familiarId !== req.userId) return res.status(403).json({ msg: 'Acesso negado.' })
    if (payment.status !== 'PAID' || !payment.paymentIntentId) {
      return res.status(409).json({ msg: 'Apenas pagamentos confirmados podem ser reembolsados.' })
    }
    const refund = await refundDestinationPayment(payment.paymentIntentId, payment.reportId)
    await stripePaymentRepo.updateStatusByReportId(payment.reportId, 'REFUND_PENDING', { refundId: refund.id })
    await reportRepo.markPaymentStatus(payment.reportId, 'REFUND_PENDING')
    return res.status(202).json({ status: 'REFUND_PENDING', refundId: refund.id })
  } catch (err) {
    logger.error('stripe:refund_failed', { error: err.message, userId: req.userId })
    return res.status(err.statusCode ?? 502).json({ msg: 'Não foi possível solicitar o reembolso.' })
  }
}
