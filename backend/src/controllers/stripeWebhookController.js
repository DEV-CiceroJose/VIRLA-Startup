import { getStripeClient } from '../services/stripeService.js'
import { processStripeEvent } from '../services/stripeWebhookService.js'
import { logger, securityLogger } from '../lib/logger.js'

export async function handleStripeWebhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    securityLogger.error('stripe:webhook_secret_missing')
    return res.status(503).json({ msg: 'Webhook Stripe não configurado.' })
  }
  if (!Buffer.isBuffer(req.rawBody)) {
    securityLogger.warn('stripe:webhook_raw_body_missing', { endpoint: req.originalUrl })
    return res.status(400).json({ msg: 'Payload bruto indisponível.' })
  }

  let event
  try {
    event = getStripeClient().webhooks.constructEvent(
      req.rawBody,
      req.headers['stripe-signature'],
      secret,
    )
  } catch (err) {
    securityLogger.warn('stripe:webhook_invalid_signature', { error: err.message, ip: req.ip })
    return res.status(400).json({ msg: 'Assinatura Stripe inválida.' })
  }

  try {
    const result = await processStripeEvent(event)
    return res.status(200).json({ received: true, handled: result.handled })
  } catch (err) {
    logger.error('stripe:webhook_processing_failed', { eventId: event.id, eventType: event.type, error: err.message })
    return res.status(500).json({ msg: 'Erro ao processar evento Stripe.' })
  }
}

