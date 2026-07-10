import test from 'node:test'
import assert from 'node:assert/strict'
import { TURNO_VALUES, FREQUENCIA_VALUES } from '../src/utils/solicitacaoOptions.js'

test('TURNO_VALUES tem os 5 turnos esperados, únicos e na ordem', () => {
  assert.deepEqual(TURNO_VALUES, ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL', 'A_COMBINAR'])
  assert.equal(new Set(TURNO_VALUES).size, TURNO_VALUES.length)
})

test('FREQUENCIA_VALUES tem as 5 frequências esperadas, únicas e na ordem', () => {
  assert.deepEqual(FREQUENCIA_VALUES, ['PONTUAL', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL'])
  assert.equal(new Set(FREQUENCIA_VALUES).size, FREQUENCIA_VALUES.length)
})
