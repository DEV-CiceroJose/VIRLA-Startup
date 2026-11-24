import test from 'node:test'
import assert from 'node:assert/strict'
import { splitChunks } from '../src/services/verificationStorage.js'
import { parseAdminEmails } from '../src/lib/adminBootstrap.js'

test('divide o arquivo cifrado em pedaços e remonta sem perder bytes', () => {
  const data = Buffer.from('x'.repeat(2500))
  const chunks = splitChunks(data, 1000)
  assert.deepEqual(chunks.map((c) => c.length), [1000, 1000, 500])
  assert.deepEqual(Buffer.concat(chunks), data)
})

test('arquivo vazio vira um único pedaço vazio', () => {
  assert.equal(splitChunks(Buffer.alloc(0), 1000).length, 1)
})

test('e-mails da equipe: separadores variados, minúsculas, sem repetidos e só válidos', () => {
  assert.deepEqual(
    parseAdminEmails(' Equipe@Virla.com ; outra@virla.com,equipe@virla.com  invalido '),
    ['equipe@virla.com', 'outra@virla.com'],
  )
  assert.deepEqual(parseAdminEmails(undefined), [])
})
