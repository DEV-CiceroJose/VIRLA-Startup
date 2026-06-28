import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmail } from '../src/utils/email.js'

test('isValidEmail aceita e-mails válidos', () => {
  assert.equal(isValidEmail('user@example.com'), true)
  assert.equal(isValidEmail('a.b+c@sub.dominio.com.br'), true)
})

test('isValidEmail rejeita formatos inválidos', () => {
  assert.equal(isValidEmail('semarroba.com'), false)
  assert.equal(isValidEmail('user@semtld'), false)
  assert.equal(isValidEmail('user@dominio.c'), false)
  assert.equal(isValidEmail(''), false)
  assert.equal(isValidEmail(null), false)
})

test('isValidEmail rejeita e-mail acima de 254 caracteres', () => {
  const long = `${'a'.repeat(250)}@x.com`
  assert.equal(isValidEmail(long), false)
})
