import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidObjectId,
  validateAmountCents,
  validateIdempotencyKey,
} from '../src/utils/validation.js'

test('isValidObjectId aceita IDs Firestore e ObjectIds Mongo; rejeita lixo', () => {
  assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true) // Mongo 24 hex (migrado)
  assert.equal(isValidObjectId('aBcD1234EfGh5678IjKl'), true)     // Firestore ~20 chars
  assert.equal(isValidObjectId('xyz'), false)                     // curto demais
  assert.equal(isValidObjectId(123), false)                       // não-string
})

test('validateAmountCents rejeita valores inválidos', () => {
  assert.equal(validateAmountCents(0).valid, false)
  assert.equal(validateAmountCents(-5).valid, false)
  assert.equal(validateAmountCents(10.5).valid, false)
  assert.equal(validateAmountCents('100').valid, false)
  assert.equal(validateAmountCents(99_999_999_99).valid, false) // acima do teto
})

test('validateAmountCents aceita inteiro positivo dentro do teto', () => {
  const r = validateAmountCents(10000)
  assert.equal(r.valid, true)
  assert.equal(r.amount, 10000)
})

test('validateIdempotencyKey exige string 8-128 com charset seguro', () => {
  assert.equal(validateIdempotencyKey('').valid, false)
  assert.equal(validateIdempotencyKey('curta').valid, false)
  assert.equal(validateIdempotencyKey('chave invalida com espaco').valid, false)
  assert.equal(validateIdempotencyKey('abc-123_def.456').valid, true)
})

test('validateIdempotencyKey rejeita valor não-string', () => {
  assert.equal(validateIdempotencyKey(12345678).valid, false)
  assert.equal(validateIdempotencyKey(null).valid, false)
  assert.equal(validateIdempotencyKey(undefined).valid, false)
})
