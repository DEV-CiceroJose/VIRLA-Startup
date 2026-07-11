import * as notificationRepo from '../repositories/notificationRepository.js'

/** Emite o evento de tempo real para a sala pessoal do destinatário. */
function emit(io, userId, notification) {
  if (io && notification) io.to(`user:${userId}`).emit('notification:new', notification)
}

/**
 * Notificação de nova mensagem (colapsada por remetente). No-op se não houver
 * destinatário ou se o remetente for o próprio destinatário.
 */
export async function notifyMessage(io, { userId, senderId, senderName, preview }) {
  if (!userId || !senderId || userId === senderId) return null
  const notification = await notificationRepo.upsertMessage({ userId, senderId, senderName, preview })
  emit(io, userId, notification)
  return notification
}

/** Notificação de evento de solicitação (assumida/concluída/cancelada). */
export async function notifySolicitacao(io, { userId, type, solicitacaoId, solicitacaoTitulo, actorId, actorName }) {
  if (!userId) return null
  const notification = await notificationRepo.create({
    userId, type, solicitacaoId, solicitacaoTitulo, actorId, actorName,
  })
  emit(io, userId, notification)
  return notification
}
