import prisma from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { getMetricsSnapshot } from '../lib/metrics.js'
import { FIREBASE_CONFIGURED } from '../lib/firebase.js'

const NODE_ENV = process.env.NODE_ENV || 'development'

/** Ping no MongoDB com timeout para não travar o health check. */
async function checkDatabase(timeoutMs = 3000) {
  try {
    await Promise.race([
      prisma.$runCommandRaw({ ping: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), timeoutMs)),
    ])
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/** Avalia o uso de memória do processo. */
function checkMemory() {
  const mem = process.memoryUsage()
  const heapRatio = mem.heapUsed / mem.heapTotal
  return {
    ok: heapRatio < 0.95,
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    heapUsedPct: Math.round(heapRatio * 100),
  }
}

/** Estado das integrações externas (configuração + leitura passiva). */
function checkApis() {
  const abacatepayConfigured = Boolean(process.env.ABACATEPAY_TOKEN)
  return {
    ok: abacatepayConfigured,
    abacatepay: abacatepayConfigured ? 'configured' : 'missing_token',
  }
}

/**
 * Chat em tempo real (Firebase RTDB). NÃO é tratado como crítico no status
 * geral (allOk) — se faltar configuração, só o chat fica degradado, o resto
 * da API continua "ok". Ver lib/firebase.js para o motivo dessa decisão.
 */
function checkFirebase() {
  return {
    ok: FIREBASE_CONFIGURED,
    chat: FIREBASE_CONFIGURED ? 'configured' : 'missing_env_or_init_failed',
  }
}

/**
 * GET /health
 * Retorna { status, database, memory, apis } + métricas básicas.
 * Responde 503 se alguma dependência crítica (banco) estiver fora.
 */
export const healthCheck = async (req, res) => {
  const [db, mem, apis] = [await checkDatabase(), checkMemory(), checkApis()]
  const firebase = checkFirebase()
  const cpu = process.cpuUsage()
  const allOk = db.ok && mem.ok
  const status = allOk ? 'ok' : 'degraded'

  if (!allOk) {
    logger.warn('health:degraded', { database: db.ok, memory: mem.ok, apis: apis.ok })
  }
  if (!firebase.ok) {
    logger.warn('health:chat_degraded', { firebase: firebase.ok })
  }

  res.status(allOk ? 200 : 503).json({
    status,
    env: NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    database: db.ok ? 'ok' : 'error',
    memory: mem.ok ? 'ok' : 'warn',
    apis: apis.ok ? 'ok' : 'warn',
    chat: firebase.ok ? 'ok' : 'degraded',
    details: {
      database: db,
      memory: mem,
      apis,
      firebase,
      cpu: { userMs: Math.round(cpu.user / 1000), systemMs: Math.round(cpu.system / 1000) },
    },
    ts: Date.now(),
  })
}

/**
 * GET /observability/dashboard
 * Métricas agregadas: últimos erros, erros por dia/endpoint, mais frequentes,
 * tempo médio de resposta. Protegido por token (header x-metrics-token).
 *
 * Em produção exige METRICS_TOKEN; em dev é liberado para facilitar testes.
 */
export const dashboard = (req, res) => {
  const expected = process.env.METRICS_TOKEN
  if (expected) {
    const provided = req.headers['x-metrics-token']
    if (provided !== expected) {
      return res.status(401).json({ msg: 'Token de métricas inválido.' })
    }
  } else if (NODE_ENV === 'production') {
    return res.status(403).json({ msg: 'METRICS_TOKEN não configurado.' })
  }

  res.status(200).json(getMetricsSnapshot())
}
