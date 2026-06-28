import { useEffect, useRef, useCallback, useState } from 'react'
import { ref, push, query, orderByChild, equalTo, onChildAdded, update, get } from 'firebase/database'
import { rtdb } from '../services/firebase'
import { connectFirebaseAuth } from '../services/firebaseAuth'

export function chatIdFor(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join('_')
}

/**
 * useFirebaseChat — substitui a entrega de mensagens que antes vinha pelo
 * evento `receive_message` do Socket.io. Agora o cliente escreve e escuta
 * diretamente o Firebase Realtime Database, o que resolve o problema de
 * mensagens não sincronizarem em produção (Sprint 1), já que o RTDB mantém
 * sua própria conexão persistente e reconexão automática nativas.
 *
 * @param {{ meId: string, peerId: string, onMessage: (msg: object) => void }} params
 */
export function useFirebaseChat({ meId, peerId, onMessage }) {
  const [ready, setReady] = useState(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const chatId = meId && peerId ? chatIdFor(meId, peerId) : null

  useEffect(() => {
    if (!chatId || !meId || !peerId) return
    let unsubscribed = false
    let unsubscribe = () => {}

    ;(async () => {
      try {
        await connectFirebaseAuth()
        if (unsubscribed) return

        const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
        unsubscribe = onChildAdded(messagesRef, (snapshot) => {
          const message = { id: snapshot.key, ...snapshot.val() }
          onMessageRef.current?.(message)
        })

        setReady(true)
      } catch (err) {
        console.error('[FirebaseChat] Falha ao conectar:', err)
      }
    })()

    return () => {
      unsubscribed = true
      unsubscribe()
    }
  }, [chatId, meId, peerId])

  /** Envia uma mensagem de texto direto para o Firebase RTDB (sem round-trip pelo backend). */
  const sendMessage = useCallback(
    async ({ content }) => {
      if (!chatId || !meId || !peerId) throw new Error('Chat não inicializado')

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
    },
    [chatId, meId, peerId]
  )

  /** Marca como lidas as mensagens recebidas de `peerId` nesse chat. */
  const markRead = useCallback(async () => {
    if (!chatId || !meId || !peerId) return
    const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
    const q = query(messagesRef, orderByChild('senderId'), equalTo(peerId))
    const snap = await get(q)
    if (!snap.exists()) return

    const updates = {}
    snap.forEach((child) => {
      if (child.val().read === false) updates[`${child.key}/read`] = true
    })
    if (Object.keys(updates).length > 0) {
      await update(messagesRef, updates)
    }
  }, [chatId, meId, peerId])

  return { chatId, ready, sendMessage, markRead }
}
