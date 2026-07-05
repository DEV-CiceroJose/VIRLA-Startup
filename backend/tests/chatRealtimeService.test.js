import test from 'node:test'
import assert from 'node:assert/strict'
import { makeFakeRtdb } from './helpers/fakeRtdb.js'
import {
  chatIdFor,
  isWithinDeleteWindow,
  deleteMessage,
  setArchived,
  getConversations,
  touchUserChats,
} from '../src/services/chatRealtimeService.js'

const NOW = 1_800_000_000_000 // epoch ms fixo p/ os testes

function seedWithMessage(overrides = {}) {
  const meId = 'ana'
  const peerId = 'bob'
  const chatId = chatIdFor(meId, peerId)
  const msg = {
    id: 'm1', senderId: meId, receiverId: peerId,
    content: 'oi', audioUrl: null, read: false, createdAt: NOW, ...overrides,
  }
  const db = makeFakeRtdb({
    chats: { [chatId]: { messages: { m1: msg } } },
    userChats: {
      [meId]: { [chatId]: { peerId, lastMessage: 'oi', lastMessageAt: NOW } },
      [peerId]: { [chatId]: { peerId: meId, lastMessage: 'oi', lastMessageAt: NOW } },
    },
  })
  return { meId, peerId, chatId, db }
}

test('isWithinDeleteWindow: dentro/fora de 10min', () => {
  assert.equal(isWithinDeleteWindow(NOW, NOW), true)
  assert.equal(isWithinDeleteWindow(NOW, NOW + 600_000), true)
  assert.equal(isWithinDeleteWindow(NOW, NOW + 600_001), false)
})

test('deleteMessage: happy path vira tombstone (deleted, content vazio, audio nulo)', async () => {
  const { meId, peerId, chatId, db } = seedWithMessage()
  const res = await deleteMessage(meId, peerId, 'm1', db)
  assert.equal(res.deleted, true)
  const stored = db.__store.chats[chatId].messages.m1
  assert.equal(stored.deleted, true)
  assert.equal(stored.content, '')
  assert.equal(stored.audioUrl, null)
  assert.equal(stored.senderId, meId) // preserva metadados
  assert.equal(stored.createdAt, NOW)
})

test('deleteMessage: rejeita quem não é o autor (forbidden)', async () => {
  const { peerId, meId, db } = seedWithMessage()
  await assert.rejects(
    () => deleteMessage(peerId, meId, 'm1', db), // bob tentando apagar msg da ana
    (e) => e.code === 'forbidden',
  )
})

test('deleteMessage: rejeita fora da janela (window_expired)', async () => {
  const { meId, peerId, chatId, db } = seedWithMessage({ createdAt: Date.now() - 700_000 })
  await assert.rejects(
    () => deleteMessage(meId, peerId, 'm1', db),
    (e) => e.code === 'window_expired',
  )
  // não virou tombstone
  assert.equal(db.__store.chats[chatId].messages.m1.deleted, undefined)
})

test('deleteMessage: mensagem inexistente (not_found)', async () => {
  const { meId, peerId, db } = seedWithMessage()
  await assert.rejects(
    () => deleteMessage(meId, peerId, 'inexistente', db),
    (e) => e.code === 'not_found',
  )
})

test('deleteMessage: se era a última mensagem, atualiza o preview dos dois userChats', async () => {
  const { meId, peerId, chatId, db } = seedWithMessage()
  await deleteMessage(meId, peerId, 'm1', db)
  assert.equal(db.__store.userChats[meId][chatId].lastMessage, '🚫 Mensagem apagada')
  assert.equal(db.__store.userChats[peerId][chatId].lastMessage, '🚫 Mensagem apagada')
})

test('setArchived: marca só o lado do próprio usuário', async () => {
  const meId = 'ana', peerId = 'bob'
  const chatId = chatIdFor(meId, peerId)
  const db = makeFakeRtdb({
    userChats: {
      [meId]: { [chatId]: { peerId, lastMessage: 'oi', lastMessageAt: NOW } },
      [peerId]: { [chatId]: { peerId: meId, lastMessage: 'oi', lastMessageAt: NOW } },
    },
  })
  await setArchived(meId, peerId, true, db)
  assert.equal(db.__store.userChats[meId][chatId].archived, true)
  assert.equal(db.__store.userChats[peerId][chatId].archived, undefined) // peer intacto
})

test('getConversations: filtra conversas arquivadas', async () => {
  const meId = 'ana'
  const db = makeFakeRtdb({
    userChats: {
      [meId]: {
        ana_bob: { peerId: 'bob', lastMessage: 'oi', lastMessageAt: NOW, archived: true },
        ana_cid: { peerId: 'cid', lastMessage: 'ola', lastMessageAt: NOW + 1 },
      },
    },
  })
  const convs = await getConversations(meId, db)
  assert.equal(convs.length, 1)
  assert.equal(convs[0].peerId, 'cid')
})

test('touchUserChats: desarquiva os dois lados (resurface com mensagem nova)', async () => {
  const meId = 'ana', peerId = 'bob'
  const chatId = chatIdFor(meId, peerId)
  const db = makeFakeRtdb({
    userChats: {
      [meId]: { [chatId]: { peerId, lastMessage: 'oi', lastMessageAt: NOW, archived: true } },
      [peerId]: { [chatId]: { peerId: meId, lastMessage: 'oi', lastMessageAt: NOW, archived: true } },
    },
  })
  await touchUserChats(chatId, meId, peerId, 'nova', NOW + 5, db)
  assert.equal(db.__store.userChats[meId][chatId].archived, false)
  assert.equal(db.__store.userChats[peerId][chatId].archived, false)
  assert.equal(db.__store.userChats[meId][chatId].lastMessage, 'nova')
})
