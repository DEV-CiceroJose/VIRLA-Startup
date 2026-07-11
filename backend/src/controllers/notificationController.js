import * as notificationRepo from '../repositories/notificationRepository.js'
import { logger } from '../lib/logger.js'

/** GET /notifications — lista as notificações do usuário + contagem de não-lidas. */
export const listNotifications = async (req, res) => {
  try {
    const userId = req.userId
    const [notifications, unreadCount] = await Promise.all([
      notificationRepo.listByUser(userId),
      notificationRepo.countUnread(userId),
    ])
    return res.status(200).json({ notifications, unreadCount })
  } catch (err) {
    logger.error('notification:list_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao buscar notificações.' })
  }
}

/** PATCH /notifications/:id/read — marca uma notificação como lida. */
export const markNotificationRead = async (req, res) => {
  try {
    const updated = await notificationRepo.markRead(req.params.id, req.userId)
    return res.status(200).json({ notification: updated })
  } catch (err) {
    if (err instanceof notificationRepo.NotificationError) {
      return res.status(404).json({ msg: err.message })
    }
    logger.error('notification:mark_read_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao marcar notificação como lida.' })
  }
}

/** POST /notifications/read-all — marca todas as não-lidas como lidas. */
export const markAllNotificationsRead = async (req, res) => {
  try {
    await notificationRepo.markAllRead(req.userId)
    return res.status(200).json({ unreadCount: 0 })
  } catch (err) {
    logger.error('notification:mark_all_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao marcar notificações como lidas.' })
  }
}

/** PATCH /notifications/conversation/:senderId/read — zera as mensagens de uma conversa. */
export const markConversationNotificationsRead = async (req, res) => {
  try {
    await notificationRepo.markConversationRead(req.userId, req.params.senderId)
    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error('notification:mark_conversation_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao marcar conversa como lida.' })
  }
}
