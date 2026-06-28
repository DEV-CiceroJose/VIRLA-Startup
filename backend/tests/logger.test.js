import test from 'node:test'
import assert from 'node:assert/strict'
import { logger, securityLogger, formatError } from '../src/lib/logger.js'

test('logger expõe os 5 níveis customizados', () => {
  for (const level of ['fatal', 'error', 'warn', 'info', 'debug']) {
    assert.equal(typeof logger[level], 'function', `nível ${level} ausente`)
  }
})

test('securityLogger é um logger independente', () => {
  assert.equal(typeof securityLogger.warn, 'function')
})

test('formatError extrai mensagem, stack, arquivo e linha', () => {
  const err = new Error('falha de teste')
  const out = formatError(err, { userId: 'u1', endpoint: '/x' })
  assert.equal(out.message, 'falha de teste')
  assert.ok(out.stack.includes('falha de teste'))
  assert.equal(out.userId, 'u1')
  assert.equal(out.endpoint, '/x')
  assert.ok(out.file, 'deveria capturar o arquivo')
  assert.equal(typeof out.line, 'number')
})

test('formatError lida com valores não-Error', () => {
  const out = formatError('string de erro')
  assert.equal(out.message, 'string de erro')
})
