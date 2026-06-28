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
import {
  getEscrow,
  releaseFunds,
  openDispute,
  getAuditTrail,
} from '../controllers/escrowController.js'
import { initiateBillingBodySchema, billingIdParamSchema } from '../schemas/paymentSchemas.js'
import { createChargeBodySchema, peerIdParamSchema } from '../schemas/chargeSchemas.js'
import { requirePaymentEnabled } from '../middlewares/paymentFlag.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const PaymentRoutes = express.Router()

// Melhoria #1 — anti-abuso: criação de cobrança/billing não tinha limite,
// permitindo gerar cobranças/cobrar PIX em massa a partir de uma única conta.
const paymentCreateLimiter = rateLimit({ windowMs: 60_000, max: 10, name: 'payment:create' })

PaymentRoutes.post(
  '/payments/charge-requests',
  checkToken,
  requireRole('CUIDADOR'),
  requirePaymentEnabled,
  paymentCreateLimiter,
  validateZod(createChargeBodySchema),
  createChargeRequest,
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
  initiateBilling,
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

export default PaymentRoutes
