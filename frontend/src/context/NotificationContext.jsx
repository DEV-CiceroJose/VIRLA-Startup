import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import api from '../services/api'
import { useAuth } from './AuthContext'
import { useSocketContext } from './SocketContext'
import {
  upsertNotification,
  countUnread,
  markReadInList,
  markAllReadInList,
  markConversationReadInList,
} from '../utils/notificationsReducer'
import { notificationText } from '../utils/notificationsView'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { profile } = useAuth()
  const { socket } = useSocketContext()
  const userId = profile?.id
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  // Carga inicial ao ter um usuário.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .get('/notifications')
      .then((res) => { if (!cancelled) setNotifications(res.data.notifications ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  // Tempo real: novas notificações. Mensagem NÃO dispara toast (o
  // receive_message_notify já cobre); status dispara toast.
  useEffect(() => {
    if (!userId) return
    const onNew = (notification) => {
      setNotifications((list) => upsertNotification(list, notification))
      if (notification.type !== 'MESSAGE') {
        toast.info('Nova notificação', { description: notificationText(notification) })
      }
    }
    socket.on('notification:new', onNew)
    return () => socket.off('notification:new', onNew)
  }, [userId, socket])

  const markRead = useCallback(async (id) => {
    setNotifications((list) => markReadInList(list, id))
    try { await api.patch(`/notifications/${id}/read`) } catch { /* estado otimista */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((list) => markAllReadInList(list))
    try { await api.post('/notifications/read-all') } catch { /* estado otimista */ }
  }, [])

  const markConversationRead = useCallback(async (senderId) => {
    setNotifications((list) => markConversationReadInList(list, senderId))
    try { await api.patch(`/notifications/conversation/${senderId}/read`) } catch { /* estado otimista */ }
  }, [])

  const unreadCount = countUnread(notifications)

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, markRead, markAllRead, markConversationRead }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return ctx
}
