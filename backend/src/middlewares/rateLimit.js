import { securityLogger } from '../lib/logger.js'

/**
 * Rate limiter em memória (sem dependências externas).
 *
 * Adequado para um único processo/instância (MVP). Em ambiente multi-instância
 * recomenda-se um store compartilhado (Redis). Janela deslizante simples por IP.
 *
 * @param {{ windowMs?: number, max?: number, name?: string }} opts
 */
export function rateLimit({ windowMs = 60_000, max = 10, name = 'generic' } = {}) {
  /** @type {Map<string, number[]>} */
  const hits = new Map()

  // Limpeza periódica para não vazar memória com IPs antigos.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs
    for (const [key, timestamps] of hits) {
      const recent = timestamps.filter((t) => t > cutoff)
      if (recent.length === 0) hits.delete(key)
      else hits.set(key, recent)
    }
  }, windowMs)
  sweep.unref?.() // não impede o processo de encerrar

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    const cutoff = now - windowMs

    const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff)
    timestamps.push(now)
    hits.set(key, timestamps)

    if (timestamps.length > max) {
      securityLogger.warn('ratelimit:exceeded', {
        limiter: name,
        ip: key,
        endpoint: req.originalUrl,
        count: timestamps.length,
      })
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000))
      return res.status(429).json({ msg: 'Muitas requisições. Tente novamente em instantes.' })
    }

    next()
  }
}
