import test from 'node:test'
import assert from 'node:assert/strict'
import { encrypt, decrypt } from '../src/lib/crypto.js'

test('encrypt → decrypt recupera o texto original', () => {
  const original = 'Mensagem secreta com acentuação çãé 🎵'
  const enc = encrypt(original)
  assert.notEqual(enc, original)
  assert.match(enc, /^[0-9a-f]+:[0-9a-f]+$/) // formato iv:ciphertext
  assert.equal(decrypt(enc), original)
})

test('IV aleatório: mesmo texto gera cifras diferentes', () => {
  const a = encrypt('repetido')
  const b = encrypt('repetido')
  assert.notEqual(a, b)
  assert.equal(decrypt(a), 'repetido')
  assert.equal(decrypt(b), 'repetido')
})

test('decrypt de texto não cifrado retorna o próprio valor (legado)', () => {
  assert.equal(decrypt('texto antigo sem dois pontos'), 'texto antigo sem dois pontos')
})

test('decrypt de payload corrompido não lança exceção', () => {
  assert.equal(decrypt('abcd:zzzz'), 'Mensagem corrompida')
})
