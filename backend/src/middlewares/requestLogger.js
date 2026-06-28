import { logger } from '../lib/logger.js'
import { recordRequest } from '../lib/metrics.js'

/**
 * Middleware de logging de requisições + coleta de métricas.
 *
 * Loga ao final de cada resposta (evento 'finish'): método, rota, status,
 * duração e usuário. Alimenta o coletor de métricas para o dashboard.
 * Rotas de health/observabilidade são ignoradas para não poluir os logs.
 */
const IGNORED_PREFIXES = ['/health', '/observability', '/uploads']

export function requestLogger(req, res, next) {
  if (IGNORED_PREFIXES.some((p) => req.path.startsWith(p))) return next()

  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6
    const meta = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.userId ?? null,
      ip: req.ip,
    }

    recordRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.userId,
    })

    if (res.statusCode >= 500) logger.error('http:request', meta)
    else if (res.statusCode >= 400) logger.warn('http:request', meta)
    else logger.info('http:request', meta)
  })

  next()
}
