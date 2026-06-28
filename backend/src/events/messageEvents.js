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
  socket.on('notify_message', ({ receiverId, preview, messageId }) => {
    if (!receiverId) return
    io.to(`user:${receiverId}`).emit('receive_message_notify', {
      senderId: userId,
      preview,
      messageId,
    })
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
