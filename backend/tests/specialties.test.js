import test from 'node:test'
import assert from 'node:assert/strict'
import { SPECIALTIES, SPECIALTY_VALUES } from '../src/utils/specialties.js'

test('SPECIALTY_VALUES traz as 17 especialidades, sem duplicatas', () => {
  assert.equal(SPECIALTY_VALUES.length, 17)
  assert.equal(new Set(SPECIALTY_VALUES).size, 17)
})

test('SPECIALTIES tem um label não-vazio para cada value', () => {
  for (const value of SPECIALTY_VALUES) {
    assert.equal(typeof SPECIALTIES[value], 'string')
    assert.ok(SPECIALTIES[value].length > 0)
  }
})
