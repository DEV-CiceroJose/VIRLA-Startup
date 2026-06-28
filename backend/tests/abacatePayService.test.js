import test from 'node:test'
import assert from 'node:assert/strict'
import { validateTaxId, validateEmail } from '../src/services/abacatePayService.js'

test('validateTaxId aceita CPF de 11 dígitos e limpa pontuação', () => {
  const r = validateTaxId('529.982.247-25')
  assert.equal(r.valid, true)
  assert.equal(r.cleaned, '52998224725')
  assert.equal(r.type, 'CPF')
})

test('validateTaxId rejeita tamanho diferente de 11', () => {
  assert.equal(validateTaxId('123').valid, false)
  assert.equal(validateTaxId('').valid, false)
})

test('validateEmail delega para o validador de e-mail', () => {
  assert.equal(validateEmail('ok@dominio.com'), true)
  assert.equal(validateEmail('ruim@'), false)
})
