import test from 'node:test'
import assert from 'node:assert/strict'
import { SPECIALTIES, SPECIALTY_VALUES } from '../src/utils/specialties.js'

test('SPECIALTY_VALUES traz as 12 especialidades, sem duplicatas', () => {
  assert.equal(SPECIALTY_VALUES.length, 12)
  assert.equal(new Set(SPECIALTY_VALUES).size, 12)
})

test('SPECIALTIES tem um label não-vazio para cada value', () => {
  for (const value of SPECIALTY_VALUES) {
    assert.equal(typeof SPECIALTIES[value], 'string')
    assert.ok(SPECIALTIES[value].length > 0)
  }
})
