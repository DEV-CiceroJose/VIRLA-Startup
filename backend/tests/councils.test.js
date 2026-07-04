import test from 'node:test'
import assert from 'node:assert/strict'
import { COUNCIL_VALUES, isValidCouncil, isValidRegister } from '../src/utils/councils.js'

test('COUNCIL_VALUES traz os 6 conselhos', () => {
  assert.deepEqual(COUNCIL_VALUES, ['COREN', 'CRM', 'CRP', 'CREFITO', 'CREF', 'CRF'])
})

test('isValidCouncil', () => {
  assert.equal(isValidCouncil('COREN'), true)
  assert.equal(isValidCouncil('XPTO'), false)
  assert.equal(isValidCouncil(''), false)
})

test('isValidRegister: base (COREN/CRM/CREFITO/CREF/CRF)', () => {
  assert.equal(isValidRegister('COREN', '123456'), true)
  assert.equal(isValidRegister('CRM', '123456-SP'), true)
  assert.equal(isValidRegister('CRF', '12345/RJ'), true)
  assert.equal(isValidRegister('COREN', 'abc'), false)
  assert.equal(isValidRegister('COREN', ''), false)
  assert.equal(isValidRegister('COREN', '12'), false) // curto demais
})

test('isValidRegister: CRP usa região/número', () => {
  assert.equal(isValidRegister('CRP', '06/12345'), true)
  assert.equal(isValidRegister('CRP', '06-12345'), true)
  assert.equal(isValidRegister('CRP', '123456'), false) // sem região
})

test('isValidRegister: conselho inválido é false', () => {
  assert.equal(isValidRegister('XPTO', '123456'), false)
})
