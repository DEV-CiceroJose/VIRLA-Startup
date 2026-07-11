import * as notificationService from '../services/notificationService.js'
import { getUserById } from '../repositories/userRepository.js'
import { logger } from '../lib/logger.js'

/**
 * Sprint 0: o envio/recebimento de mensagens deixou de depender do Socket.io
 * (que sofria com reconexões/falhas de upgrade WebSocket em produção).
 * Agora o cliente escreve diretamente no Firebase Realtime Database
 * (`chats/{chatId}/messages`) e ouve as mudanças via `onChildAdded` — a
 * sincronização em tempo real é nativa do RTDB, sem precisar de socket.
 *
 * O Socket.io permanece útil apenas para sinais efêmeros e baratos que não
 * precisam de persistência: indicador de "digitando…", presença online/offline
 * e um aviso leve de "nova mensagem" para acionar toast/som globalmente
 * mesmo quando o usuário não está com o RTDB listener daquele chat montado.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerMessageEvents(socket, io) {
  const { userId } = socket

  // --- notify_message: aviso leve (sem conteúdo sensível) para notificação global ---
  // Disparado pelo frontend logo após escrever a mensagem no Firebase RTDB.
  socket.on('notify_message', async ({ receiverId, preview, messageId }) => {
    if (!receiverId) return
    io.to(`user:${receiverId}`).emit('receive_message_notify', {
      senderId: userId,
      preview,
      messageId,
    })
    // Persiste a notificação de mensagem (colapsada) sem bloquear o "toque":
    // se falhar, a mensagem (RTDB) e o toast já aconteceram mesmo assim.
    try {
      const sender = await getUserById(userId)
      await notificationService.notifyMessage(io, {
        userId: receiverId,
        senderId: userId,
        senderName: sender?.name ?? null,
        preview,
      })
    } catch (err) {
      logger.error('notification:message_failed', { error: err.message, senderId: userId, receiverId })
    }
  })

  // --- user:typing ---
  socket.on('user:typing', ({ receiverId, isTyping }) => {
    if (!receiverId) return
    io.to(`user:${receiverId}`).emit('peer:typing', { senderId: userId, isTyping })
  })

  // --- message:read --- (aviso leve; a flag `read` real é gravada no RTDB pelo cliente)
  socket.on('message:read', ({ senderId }) => {
    if (!senderId) return
    io.to(`user:${senderId}`).emit('message:read_ack', { readerId: userId })
  })
}
