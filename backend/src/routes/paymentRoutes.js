import express from 'express'
import checkToken from '../middlewares/checkToken.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validateZod } from '../middlewares/validateZod.js'
import { initiateBilling, pollBillingStatus } from '../controllers/paymentController.js'
import {
  createChargeRequest,
  getPendingChargeWithPeer,
} from '../controllers/chargeRequestController.js'
import { handleAbacatePayWebhook } from '../controllers/webhookController.js'
import { handleStripeWebhook } from '../controllers/stripeWebhookController.js'
import { createCheckoutSession, getCheckoutStatus, refundStripePayment } from '../controllers/stripePaymentController.js'
import { createConnectDashboardLink, createConnectOnboarding, getConnectStatus } from '../controllers/stripeConnectController.js'
import {
  getEscrow,
  releaseFunds,
  openDispute,
  getAuditTrail,
} from '../controllers/escrowController.js'
import {
  initiateBillingBodySchema,
  billingIdParamSchema,
  checkoutSessionBodySchema,
  checkoutSessionIdParamSchema,
  reportPaymentParamSchema,
} from '../schemas/paymentSchemas.js'
import { createChargeBodySchema, peerIdParamSchema } from '../schemas/chargeSchemas.js'
import { requirePaymentEnabled } from '../middlewares/paymentFlag.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const PaymentRoutes = express.Router()

// Melhoria #1 — anti-abuso: criação de cobrança/billing não tinha limite,
// permitindo gerar cobranças/cobrar PIX em massa a partir de uma única conta.
const paymentCreateLimiter = rateLimit({ windowMs: 60_000, max: 10, name: 'payment:create' })
const legacyPaymentDisabled = (_req, res) => res.status(410).json({
  msg: 'O pagamento antigo foi desativado. O pagamento agora é liberado pelo relatório assinado da solicitação.',
  code: 'SIGNED_REPORT_PAYMENT_REQUIRED',
})

PaymentRoutes.get('/stripe/connect/status', checkToken, requireRole('CUIDADOR'), getConnectStatus)
PaymentRoutes.post('/stripe/connect/onboarding', checkToken, requireRole('CUIDADOR'), paymentCreateLimiter, createConnectOnboarding)
PaymentRoutes.post('/stripe/connect/dashboard-link', checkToken, requireRole('CUIDADOR'), paymentCreateLimiter, createConnectDashboardLink)

PaymentRoutes.post(
  '/payments/checkout-sessions',
  checkToken,
  requireRole('FAMILIAR'),
  requirePaymentEnabled,
  paymentCreateLimiter,
  validateZod(checkoutSessionBodySchema),
  createCheckoutSession,
)
PaymentRoutes.get(
  '/payments/checkout-sessions/:sessionId/status',
  checkToken,
  requireRole('FAMILIAR'),
  validateZod(checkoutSessionIdParamSchema, 'params'),
  getCheckoutStatus,
)
PaymentRoutes.post(
  '/payments/:reportId/refund',
  checkToken,
  requireRole('FAMILIAR'),
  validateZod(reportPaymentParamSchema, 'params'),
  refundStripePayment,
)

PaymentRoutes.post(
  '/payments/charge-requests',
  checkToken,
  requireRole('CUIDADOR'),
  requirePaymentEnabled,
  paymentCreateLimiter,
  validateZod(createChargeBodySchema),
  legacyPaymentDisabled,
)
PaymentRoutes.get(
  '/payments/charge-requests/pending/:peerId',
  checkToken,
  validateZod(peerIdParamSchema, 'params'),
  getPendingChargeWithPeer,
)

PaymentRoutes.post(
  '/payments/billing',
  checkToken,
  requireRole('FAMILIAR'),
  requirePaymentEnabled,
  paymentCreateLimiter,
  validateZod(initiateBillingBodySchema),
  legacyPaymentDisabled,
)
PaymentRoutes.get(
  '/payments/billing/:billingId/status',
  checkToken,
  validateZod(billingIdParamSchema, 'params'),
  pollBillingStatus,
)

PaymentRoutes.get('/escrow/:escrowId', checkToken, getEscrow)
PaymentRoutes.get('/escrow/:escrowId/audit', checkToken, getAuditTrail)
PaymentRoutes.post('/escrow/:escrowId/release', checkToken, releaseFunds)
PaymentRoutes.post('/escrow/:escrowId/dispute', checkToken, openDispute)

PaymentRoutes.post(
  '/webhooks/abacatepay',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
    req.rawBody = raw
    try {
      req.body = JSON.parse(raw)
    } catch {
      req.body = {}
    }
    next()
  },
  handleAbacatePayWebhook,
)

PaymentRoutes.post('/webhooks/stripe', handleStripeWebhook)

export default PaymentRoutes
