import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateChargeTotalCents } from '../src/utils/paymentFees.js'

test('mantém o total igual ao contrato, sem taxa adicional', () => {
  const r = calculateChargeTotalCents(10000)
  assert.equal(r.baseCents, 10000)
  assert.equal(r.platformFeeCents, 0)
  assert.equal(r.fixedFeeCents, 0)
  assert.equal(r.totalCents, 10000)
})

test('preserva valores inteiros em centavos', () => {
  const r = calculateChargeTotalCents(1505)
  assert.equal(r.platformFeeCents, 0)
  assert.equal(r.totalCents, 1505)
})

test('valor base zero não cria taxa fixa', () => {
  const r = calculateChargeTotalCents(0)
  assert.equal(r.totalCents, 0)
})
