import { useEffect, useRef, useCallback, useState } from 'react'
import { ref, push, onChildAdded, update, get } from 'firebase/database'
import { rtdb, isFirebaseReady, getFirebaseInitError } from '../services/firebase'
import { connectFirebaseAuth } from '../services/firebaseAuth'
import api from '../services/api'

const POLL_INTERVAL_MS = 4000

export function chatIdFor(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join('_')
}

function isFirebaseAuthConfigError(err) {
  const code = err?.code ?? ''
  const msg = String(err?.message ?? '').toLowerCase()
  return code === 'auth/configuration-not-found' || msg.includes('configuration-not-found')
}

/**
 * useFirebaseChat — entrega de mensagens via Firebase RTDB quando possível.
 * Se a autenticação Firebase falhar (ex.: Auth não habilitado no Console),
 * faz fallback automático para a API REST + polling leve.
 */
export function useFirebaseChat({ meId, peerId, onMessage }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(() => getFirebaseInitError())
  const [usingApiFallback, setUsingApiFallback] = useState(false)
  const onMessageRef = useRef(onMessage)
  const seenIdsRef = useRef(new Set())
  onMessageRef.current = onMessage

  const chatId = meId && peerId ? chatIdFor(meId, peerId) : null

  const deliverMessage = useCallback((message) => {
    if (!message?.id || seenIdsRef.current.has(message.id)) return
    seenIdsRef.current.add(message.id)
    onMessageRef.current?.(message)
  }, [])

  const pollHistory = useCallback(async () => {
    if (!peerId) return
    try {
      const res = await api.get(`/messages/history/${peerId}`)
      for (const message of res.data.messages ?? []) {
        deliverMessage(message)
      }
    } catch (err) {
      console.error('[FirebaseChat] Falha ao sincronizar via API:', err)
    }
  }, [peerId, deliverMessage])

  useEffect(() => {
    seenIdsRef.current = new Set()
  }, [chatId])

  useEffect(() => {
    if (!chatId || !meId || !peerId) return

    if (!isFirebaseReady() || !rtdb) {
      setUsingApiFallback(true)
      setError(getFirebaseInitError() ?? 'Firebase não configurado — usando API.')
      setReady(true)
      pollHistory()
      const interval = setInterval(pollHistory, POLL_INTERVAL_MS)
      return () => clearInterval(interval)
    }

    let unsubscribed = false
    let unsubscribe = () => {}
    let pollInterval = null

    const startApiFallback = (reason) => {
      if (unsubscribed) return
      unsubscribe()
      unsubscribe = () => {}
      setUsingApiFallback(true)
      setError(reason)
      setReady(true)
      pollHistory()
      pollInterval = setInterval(pollHistory, POLL_INTERVAL_MS)
    }

    ;(async () => {
      try {
        await connectFirebaseAuth()
        if (unsubscribed) return

        const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
        unsubscribe = onChildAdded(messagesRef, (snapshot) => {
          deliverMessage({ id: snapshot.key, ...snapshot.val() })
        })

        setUsingApiFallback(false)
        setError(null)
        setReady(true)
      } catch (err) {
        console.error('[FirebaseChat] Falha ao conectar:', err)
        const reason = isFirebaseAuthConfigError(err)
          ? 'Firebase Auth não está habilitado no projeto — chat via API ativo.'
          : (err.message ?? 'Falha ao conectar ao chat em tempo real — chat via API ativo.')
        startApiFallback(reason)
      }
    })()

    return () => {
      unsubscribed = true
      unsubscribe()
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [chatId, meId, peerId, pollHistory, deliverMessage])

  const sendMessage = useCallback(
    async ({ content }) => {
      if (!chatId || !meId || !peerId) throw new Error('Chat não inicializado')

      if (usingApiFallback || !isFirebaseReady() || !rtdb) {
        const res = await api.post('/messages', { receiverId: peerId, content })
        const message = res.data.message
        deliverMessage(message)
        return message
      }

      try {
        await connectFirebaseAuth()

        const newRef = push(ref(rtdb, `chats/${chatId}/messages`))
        const createdAtMs = Date.now()

        const message = {
          senderId: meId,
          receiverId: peerId,
          content,
          audioUrl: null,
          read: false,
          createdAt: createdAtMs,
        }

        await update(ref(rtdb), {
          [`chats/${chatId}/messages/${newRef.key}`]: message,
          [`chats/${chatId}/members/${meId}`]: true,
          [`chats/${chatId}/members/${peerId}`]: true,
          [`userChats/${meId}/${chatId}`]: { peerId, lastMessage: content, lastMessageAt: createdAtMs },
          [`userChats/${peerId}/${chatId}`]: { peerId: meId, lastMessage: content, lastMessageAt: createdAtMs },
        })

        return { id: newRef.key, ...message }
      } catch (err) {
        if (isFirebaseAuthConfigError(err) || !isFirebaseReady()) {
          const res = await api.post('/messages', { receiverId: peerId, content })
          const message = res.data.message
          deliverMessage(message)
          return message
        }
        throw err
      }
    },
    [chatId, meId, peerId, usingApiFallback, deliverMessage]
  )

  const markRead = useCallback(async () => {
    if (!chatId || !meId || !peerId) return

    if (usingApiFallback || !isFirebaseReady() || !rtdb) {
      await api.patch(`/messages/read/${peerId}`)
      return
    }

    try {
      await connectFirebaseAuth()
      const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
      const snap = await get(messagesRef)
      if (!snap.exists()) return

      const updates = {}
      snap.forEach((child) => {
        const val = child.val()
        if (val.senderId === peerId && val.read === false) {
          updates[`${child.key}/read`] = true
        }
      })
      if (Object.keys(updates).length > 0) {
        await update(messagesRef, updates)
      }
    } catch {
      await api.patch(`/messages/read/${peerId}`).catch(() => {})
    }
  }, [chatId, meId, peerId, usingApiFallback])

  return { chatId, ready, error, usingApiFallback, sendMessage, markRead }
}
