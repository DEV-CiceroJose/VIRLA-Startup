/**
 * Coletor de métricas em memória para observabilidade.
 *
 * Mantém contadores agregados e um buffer circular dos últimos erros para
 * alimentar o endpoint de dashboard (/observability/dashboard). É leve e
 * sem dependências; para histórico persistente use os arquivos em logs/.
 */

const MAX_RECENT_ERRORS = 50

const state = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  totalResponseTimeMs: 0,
  // endpoint -> { count, errors, totalMs }
  byEndpoint: new Map(),
  // 'YYYY-MM-DD' -> nº de erros
  errorsByDay: new Map(),
  // buffer circular dos últimos erros
  recentErrors: [],
}

/** Normaliza a rota para evitar explosão de chaves por IDs (ex.: /users/123 → /users/:id). */
function normalizePath(path) {
  return String(path || '/')
    .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id') // ObjectIds Mongo
    .replace(/\/\d+(?=\/|$)/g, '/:id') // ids numéricos
}

/**
 * Registra uma requisição concluída.
 * @param {{ method: string, path: string, statusCode: number, durationMs: number, userId?: string }} req
 */
export function recordRequest({ method, path, statusCode, durationMs, userId }) {
  const key = `${method} ${normalizePath(path)}`
  state.totalRequests += 1
  state.totalResponseTimeMs += durationMs

  const entry = state.byEndpoint.get(key) ?? { count: 0, errors: 0, totalMs: 0 }
  entry.count += 1
  entry.totalMs += durationMs

  const isError = statusCode >= 500
  if (isError) {
    state.totalErrors += 1
    entry.errors += 1
    const day = new Date().toISOString().slice(0, 10)
    state.errorsByDay.set(day, (state.errorsByDay.get(day) ?? 0) + 1)
    state.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      endpoint: key,
      statusCode,
      userId: userId ?? null,
      durationMs,
    })
    if (state.recentErrors.length > MAX_RECENT_ERRORS) state.recentErrors.pop()
  }

  state.byEndpoint.set(key, entry)
}

/** Snapshot agregado para o dashboard. */
export function getMetricsSnapshot() {
  const endpoints = [...state.byEndpoint.entries()].map(([endpoint, v]) => ({
    endpoint,
    count: v.count,
    errors: v.errors,
    avgResponseMs: v.count ? Math.round(v.totalMs / v.count) : 0,
  }))

  return {
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    totalRequests: state.totalRequests,
    totalErrors: state.totalErrors,
    avgResponseMs: state.totalRequests
      ? Math.round(state.totalResponseTimeMs / state.totalRequests)
      : 0,
    errorsByDay: Object.fromEntries(state.errorsByDay),
    topEndpoints: [...endpoints].sort((a, b) => b.count - a.count).slice(0, 10),
    errorsByEndpoint: endpoints
      .filter((e) => e.errors > 0)
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 10),
    slowestEndpoints: [...endpoints]
      .sort((a, b) => b.avgResponseMs - a.avgResponseMs)
      .slice(0, 10),
    recentErrors: state.recentErrors,
  }
}
