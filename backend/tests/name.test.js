import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidName } from '../src/utils/name.js'

test('aceita nomes válidos (compostos, acentos, hífen, apóstrofo)', () => {
  assert.equal(isValidName('Ana Souza'), true)
  assert.equal(isValidName('Maria de Fátima'), true)
  assert.equal(isValidName("D'Ávila"), true)
  assert.equal(isValidName('Ana-Clara'), true)
  assert.equal(isValidName('Jr.'), true)
})

test('rejeita dígitos, símbolos, sequências e repetição', () => {
  assert.equal(isValidName('123456'), false)
  assert.equal(isValidName('@@@@@@'), false)
  assert.equal(isValidName('AAAAAAAAAA'), false)
  assert.equal(isValidName('Ana123'), false)
  assert.equal(isValidName('A'), false)   // curto demais
  assert.equal(isValidName(''), false)
  assert.equal(isValidName('   '), false)
})
