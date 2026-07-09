import test from 'node:test'
import assert from 'node:assert/strict'
import { attachmentTypeFor, ATTACHMENT_MIMES, MAX_ATTACHMENT_BYTES } from '../src/utils/attachment.js'

test('attachmentTypeFor: imagens → "image"', () => {
  assert.equal(attachmentTypeFor('image/jpeg'), 'image')
  assert.equal(attachmentTypeFor('image/png'), 'image')
  assert.equal(attachmentTypeFor('image/webp'), 'image')
  assert.equal(attachmentTypeFor('image/gif'), 'image')
})

test('attachmentTypeFor: pdf → "pdf"', () => {
  assert.equal(attachmentTypeFor('application/pdf'), 'pdf')
})

test('attachmentTypeFor: tipos fora da whitelist → null', () => {
  assert.equal(attachmentTypeFor('image/svg+xml'), null)
  assert.equal(attachmentTypeFor('application/zip'), null)
  assert.equal(attachmentTypeFor('text/html'), null)
  assert.equal(attachmentTypeFor(''), null)
  assert.equal(attachmentTypeFor(undefined), null)
})

test('constantes: MIMES cobrem imagem+pdf; limite é 5MB', () => {
  assert.ok(ATTACHMENT_MIMES.includes('image/jpeg'))
  assert.ok(ATTACHMENT_MIMES.includes('application/pdf'))
  assert.equal(MAX_ATTACHMENT_BYTES, 5 * 1024 * 1024)
})
