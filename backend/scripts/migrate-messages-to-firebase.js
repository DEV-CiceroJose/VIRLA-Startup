/**
 * Script de migração — Sprint 0
 *
 * Lê todas as mensagens existentes no MongoDB (via Prisma), descriptografa
 * o conteúdo (mesma lógica usada hoje na leitura) e grava no Firebase
 * Realtime Database na nova estrutura usada por chatRealtimeService.js.
 *
 * Uso:
 *   node scripts/migrate-messages-to-firebase.js
 *
 * É seguro rodar mais de uma vez: usa o próprio `id` da mensagem do Mongo
 * como chave no RTDB (set idempotente), em vez de gerar uma chave nova
 * a cada execução.
 */
import 'dotenv/config'
import prisma from '../src/lib/prisma.js'
import { rtdb } from '../src/lib/firebase.js'
import { decrypt } from '../src/lib/crypto.js'
import { chatIdFor } from '../src/services/chatRealtimeService.js'

async function migrate() {
  console.log('Iniciando migração de mensagens Mongo → Firebase Realtime Database...')

  const messages = await prisma.message.findMany({ orderBy: { createdAt: 'asc' } })
  console.log(`Encontradas ${messages.length} mensagens no MongoDB.`)

  if (messages.length === 0) {
    console.log('Nada para migrar.')
    return
  }

  // Agrupa updates por chat para minimizar o número de writes no RTDB.
  const updatesByChat = new Map()
  const userChatsUpdates = {}
  const membersUpdates = {}

  for (const m of messages) {
    const chatId = chatIdFor(m.senderId, m.receiverId)

    let content
    try {
      content = decrypt(m.content)
    } catch {
      content = m.content // fallback: já estava em texto puro
    }

    const createdAt = new Date(m.createdAt).getTime()

    const payload = {
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content,
      audioUrl: m.audioUrl ?? null,
      read: m.read,
      createdAt,
    }

    if (!updatesByChat.has(chatId)) updatesByChat.set(chatId, {})
    updatesByChat.get(chatId)[m.id] = payload

    membersUpdates[`chats/${chatId}/members/${m.senderId}`] = true
    membersUpdates[`chats/${chatId}/members/${m.receiverId}`] = true

    // userChats: como estamos iterando em ordem ascendente de data, a última
    // escrita de cada chat acaba sendo a mensagem mais recente — correto.
    userChatsUpdates[`userChats/${m.senderId}/${chatId}`] = { peerId: m.receiverId, lastMessage: content, lastMessageAt: createdAt }
    userChatsUpdates[`userChats/${m.receiverId}/${chatId}`] = { peerId: m.senderId, lastMessage: content, lastMessageAt: createdAt }
  }

  console.log(`Gravando mensagens em ${updatesByChat.size} conversas...`)
  for (const [chatId, messagesObj] of updatesByChat.entries()) {
    await rtdb.ref(`chats/${chatId}/messages`).update(messagesObj)
  }

  console.log('Gravando membros dos chats e índice de conversas (userChats)...')
  await rtdb.ref().update({ ...membersUpdates, ...userChatsUpdates })

  console.log('Migração concluída com sucesso! ✅')
  console.log(`Total de mensagens migradas: ${messages.length}`)
  console.log(`Total de conversas (chats) migradas: ${updatesByChat.size}`)
}

migrate()
  .catch((err) => {
    console.error('Falha na migração:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit()
  })
