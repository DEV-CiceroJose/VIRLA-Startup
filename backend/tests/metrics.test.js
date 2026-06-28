import test from 'node:test'
import assert from 'node:assert/strict'
import { recordRequest, getMetricsSnapshot } from '../src/lib/metrics.js'

test('recordRequest agrega contadores e normaliza IDs na rota', () => {
  recordRequest({ method: 'GET', path: '/users/507f1f77bcf86cd799439011', statusCode: 200, durationMs: 10 })
  recordRequest({ method: 'GET', path: '/users/507f1f77bcf86cd799439012', statusCode: 200, durationMs: 30 })

  const snap = getMetricsSnapshot()
  assert.ok(snap.totalRequests >= 2)
  const userEndpoint = snap.topEndpoints.find((e) => e.endpoint === 'GET /users/:id')
  assert.ok(userEndpoint, 'rotas com ID devem ser agrupadas em /users/:id')
  assert.ok(userEndpoint.count >= 2)
})

test('erros 5xx alimentam recentErrors e errorsByEndpoint', () => {
  recordRequest({ method: 'POST', path: '/payments/billing', statusCode: 500, durationMs: 5, userId: 'u9' })
  const snap = getMetricsSnapshot()
  assert.ok(snap.totalErrors >= 1)
  assert.ok(snap.recentErrors.some((e) => e.endpoint === 'POST /payments/billing'))
  assert.ok(snap.errorsByEndpoint.some((e) => e.endpoint === 'POST /payments/billing'))
})
