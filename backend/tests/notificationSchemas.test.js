import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationIdParamSchema, senderIdParamSchema } from '../src/schemas/notificationSchemas.js'

test('notificationIdParamSchema aceita id válido do Firestore', () => {
  assert.equal(notificationIdParamSchema.safeParse({ id: 'abc123ABC_def-456xy' }).success, true)
})

test('notificationIdParamSchema rejeita id malformado', () => {
  assert.equal(notificationIdParamSchema.safeParse({ id: 'x' }).success, false)
})

test('senderIdParamSchema aceita senderId válido', () => {
  assert.equal(senderIdParamSchema.safeParse({ senderId: 'abc123ABC_def-456xy' }).success, true)
})

test('senderIdParamSchema rejeita senderId malformado', () => {
  assert.equal(senderIdParamSchema.safeParse({ senderId: '!!' }).success, false)
})
