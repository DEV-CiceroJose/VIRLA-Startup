import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidCPF, stripCpf } from '../src/utils/cpf.js'

test('stripCpf remove pontuação', () => {
  assert.equal(stripCpf('123.456.789-09'), '12345678909')
  assert.equal(stripCpf(null), '')
  assert.equal(stripCpf(undefined), '')
})

test('isValidCPF aceita CPF válido', () => {
  assert.equal(isValidCPF('529.982.247-25'), true)
  assert.equal(isValidCPF('52998224725'), true)
})

test('isValidCPF rejeita dígitos verificadores errados', () => {
  assert.equal(isValidCPF('529.982.247-24'), false)
})

test('isValidCPF rejeita sequências repetidas', () => {
  assert.equal(isValidCPF('111.111.111-11'), false)
  assert.equal(isValidCPF('00000000000'), false)
})

test('isValidCPF rejeita tamanho incorreto', () => {
  assert.equal(isValidCPF('1234567890'), false)
  assert.equal(isValidCPF(''), false)
})
