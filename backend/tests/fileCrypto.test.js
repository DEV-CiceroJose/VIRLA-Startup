import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptBuffer, decryptBuffer } from '../src/lib/fileCrypto.js'

const KEY = '0123456789abcdef0123456789abcdef'

test('cifra e decifra arquivos sem perder bytes', () => {
  const original = Buffer.from('%PDF-1.4 certidão de teste ✓')
  const sealed = encryptBuffer(original, KEY)
  assert.notDeepEqual(sealed, original)
  assert.equal(sealed.includes(original), false)
  assert.deepEqual(decryptBuffer(sealed, KEY), original)
})

test('cada cifragem usa IV novo', () => {
  const data = Buffer.from('mesmo conteúdo')
  assert.notDeepEqual(encryptBuffer(data, KEY), encryptBuffer(data, KEY))
})

test('arquivo adulterado é recusado (GCM)', () => {
  const sealed = encryptBuffer(Buffer.from('documento'), KEY)
  sealed[sealed.length - 1] ^= 0xff
  assert.throws(() => decryptBuffer(sealed, KEY))
})

test('chave com tamanho errado é recusada', () => {
  assert.throws(() => encryptBuffer(Buffer.from('x'), 'curta'), /32 caracteres/)
})
