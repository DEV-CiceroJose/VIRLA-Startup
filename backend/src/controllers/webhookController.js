import crypto from 'crypto'
import { processPaymentEvent } from '../services/paymentWebhookService.js'
import { securityLogger, logger } from '../lib/logger.js'

const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET ?? ''

/**
 * Verifica assinatura HMAC-SHA256 do AbacatePay com comparação timing-safe.
 *
 * @param {string} rawBody
 * @param {string} signature
 */
function verifySignature(rawBody, signature) {
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      securityLogger.error('webhook:secret_missing', {
        msg: 'ABACATEPAY_WEBHOOK_SECRET não configurado em produção — rejeitando.',
      })
      return false
    }
    securityLogger.warn('webhook:signature_check_disabled', { env: 'development' })
    return true
  }

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')

  const sig = String(signature ?? '').trim()
  if (!sig || sig.length !== expected.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(sig, 'utf8'),
    )
  } catch {
    return false
  }
}

/**
 * POST /webhooks/abacatepay
 * Processa reconciliação antes do 200 para reduzir perda de eventos em crash.
 */
export const handleAbacatePayWebhook = async (req, res) => {
  const rawBody = req.rawBody ?? JSON.stringify(req.body)
  const signature = req.headers['x-abacatepay-signature'] ?? ''

  if (!verifySignature(rawBody, signature)) {
    securityLogger.warn('webhook:invalid_signature', {
      ip: req.ip,
      endpoint: req.originalUrl,
    })
    return res.status(401).json({ msg: 'Assinatura inválida.' })
  }

  try {
    await processPaymentEvent(req.body)
    return res.status(200).json({ received: true })
  } catch (err) {
    logger.error('webhook:processing_failed', {
      error: err.message,
      stack: err.stack,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao processar webhook.' })
  }
}
