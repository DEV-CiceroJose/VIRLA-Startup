import test from 'node:test'
import assert from 'node:assert/strict'
import { NOTIFICATION_TYPES } from '../src/utils/notificationTypes.js'

test('NOTIFICATION_TYPES tem os 6 tipos esperados, únicos e na ordem', () => {
  assert.deepEqual(NOTIFICATION_TYPES, [
    'MESSAGE',
    'SOLICITACAO_ASSUMIDA',
    'SOLICITACAO_CONCLUIDA',
    'SOLICITACAO_CANCELADA',
    'VERIFICACAO_APROVADA',
    'VERIFICACAO_REPROVADA',
  ])
  assert.equal(new Set(NOTIFICATION_TYPES).size, NOTIFICATION_TYPES.length)
})
