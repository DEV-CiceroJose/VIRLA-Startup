import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateChargeTotalCents } from '../src/utils/paymentFees.js'

test('calcula total = base + 7% + R$0,80', () => {
  // base R$100,00 = 10000 centavos → 7% = 700 + 80 fixo = 10780
  const r = calculateChargeTotalCents(10000)
  assert.equal(r.baseCents, 10000)
  assert.equal(r.platformFeeCents, 700)
  assert.equal(r.fixedFeeCents, 80)
  assert.equal(r.totalCents, 10780)
})

test('arredonda a taxa percentual', () => {
  // 7% de 1505 = 105.35 → arredonda para 105
  const r = calculateChargeTotalCents(1505)
  assert.equal(r.platformFeeCents, 105)
  assert.equal(r.totalCents, 1505 + 105 + 80)
})

test('valor base zero gera apenas taxa fixa', () => {
  const r = calculateChargeTotalCents(0)
  assert.equal(r.totalCents, 80)
})
