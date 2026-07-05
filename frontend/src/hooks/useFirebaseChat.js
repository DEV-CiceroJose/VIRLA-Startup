import { useEffect, useRef, useCallback, useState } from 'react'
import { ref, push, onChildAdded, onChildChanged, update, get } from 'firebase/database'
import { rtdb, isFirebaseReady } from '../services/firebase'

export function chatIdFor(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join('_')
}

/**
 * useFirebaseChat — entrega de mensagens em tempo real via Firebase Realtime
 * Database (substituiu o `receive_message` do Socket.io na Sprint 1).
 *
 * Resiliência (correção do "chat não abre"): se o Firebase não estiver
 * configurado ou a autenticação falhar (ex.: serviço de Auth desativado no
 * console), o hook NÃO derruba a tela — ele apenas reporta `realtimeActive:
 * false`, e a página de Chat assume o modo de contingência por HTTP (polling).
 *
 * @param {{ meId: string, peerId: string, onMessage: (msg: object) => void, onMessageChanged?: (msg: object) => void }} params
 */
export function useFirebaseChat({ meId, peerId, onMessage, onMessageChanged }) {
  const [ready, setReady] = useState(false)
  // realtimeActive=false → a página de Chat deve buscar histórico por HTTP.
  const [realtimeActive, setRealtimeActive] = useState(false)
  const onMessageRef = useRef(onMessage)
  const onMessageChangedRef = useRef(onMessageChanged)
  // Mantém os refs "latest" sem tocá-los durante o render (os callbacks são
  // chamados de forma assíncrona pelos listeners do RTDB, já depois do effect).
  useEffect(() => {
    onMessageRef.current = onMessage
    onMessageChangedRef.current = onMessageChanged
  })

  const chatId = meId && peerId ? chatIdFor(meId, peerId) : null

  useEffect(() => {
    if (!chatId || !meId || !peerId) return

    // Sem Firebase: não tenta assinar; chat opera em fallback HTTP.
    if (!isFirebaseReady() || !rtdb) {
      setRealtimeActive(false)
      setReady(false)
      return
    }

    let unsubscribed = false
    let unsubscribe = () => {}

    ;(async () => {
      try {
        // O usuário já está autenticado no Firebase Auth (AuthContext), então
        // as Security Rules do RTDB liberam o acesso — não é preciso trocar
        // custom token aqui.
        if (unsubscribed) return

        const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
        const offAdded = onChildAdded(messagesRef, (snapshot) => {
          const message = { id: snapshot.key, ...snapshot.val() }
          onMessageRef.current?.(message)
        })
        const offChanged = onChildChanged(messagesRef, (snapshot) => {
          const message = { id: snapshot.key, ...snapshot.val() }
          onMessageChangedRef.current?.(message)
        })
        unsubscribe = () => { offAdded(); offChanged() }

        setRealtimeActive(true)
        setReady(true)
      } catch (err) {
        // Auth desativado / falha de rede: cai no fallback HTTP sem crashar.
        console.error('[FirebaseChat] Falha ao conectar — usando fallback HTTP:', err)
        setRealtimeActive(false)
        setReady(false)
      }
    })()

    return () => {
      unsubscribed = true
      unsubscribe()
    }
  }, [chatId, meId, peerId])

  /**
   * Envia uma mensagem direto pelo Firebase RTDB. Se o Firebase não estiver
   * disponível, lança — a página de Chat captura e reenvia via POST /messages.
   */
  const sendMessage = useCallback(
    async ({ content }) => {
      if (!chatId || !meId || !peerId) throw new Error('Chat não inicializado')
      if (!isFirebaseReady() || !rtdb) throw new Error('Firebase indisponível')

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

  /**
   * Marca como lidas as mensagens recebidas de `peerId`.
   *
   * CORREÇÃO (erro de índice): leitura completa do nó + filtro em memória,
   * em vez de `query(orderByChild('senderId'), equalTo(peerId))`, que exigia
   * a regra `.indexOn` publicada no Firebase.
   */
  const markRead = useCallback(async () => {
    if (!chatId || !meId || !peerId) return
    if (!isFirebaseReady() || !rtdb) return

    const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
    const snap = await get(messagesRef)
    if (!snap.exists()) return

    const updates = {}
    snap.forEach((child) => {
      const v = child.val()
      if (v.senderId === peerId && v.read === false) updates[`${child.key}/read`] = true
    })
    if (Object.keys(updates).length > 0) {
      await update(messagesRef, updates)
    }
  }, [chatId, meId, peerId])

  return { chatId, ready, realtimeActive, sendMessage, markRead }
}
