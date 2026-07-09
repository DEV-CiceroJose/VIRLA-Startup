import { useEffect, useState } from 'react'
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database'
import { rtdb, isFirebaseReady } from '../services/firebase'

/**
 * Publica a presença do próprio usuário no RTDB (padrão canônico do Firebase).
 * Enquanto conectado, mantém status/{uid} = { state:'online', lastChanged } e
 * registra um onDisconnect que grava 'offline' quando a conexão cair (fechar
 * aba, crash, queda de rede) — o servidor do Firebase dispara isso sozinho.
 *
 * No-opa se não houver uid ou o Firebase não estiver disponível (resiliência:
 * a presença simplesmente não aparece, sem derrubar a tela).
 */
export function usePresence(uid) {
  useEffect(() => {
    if (!uid || !isFirebaseReady() || !rtdb) return undefined

    const statusRef = ref(rtdb, `status/${uid}`)
    const connectedRef = ref(rtdb, '.info/connected')

    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return
      // Registra o "offline ao desconectar" ANTES de marcar online, pra garantir
      // que o servidor tenha o handler mesmo se a conexão cair logo em seguida.
      onDisconnect(statusRef)
        .set({ state: 'offline', lastChanged: serverTimestamp() })
        .then(() => set(statusRef, { state: 'online', lastChanged: serverTimestamp() }))
        .catch((err) => console.error('[presence] falha ao publicar presença:', err))
    })

    return () => {
      unsub()
      // Logout em SPA (sem fechar a aba): a conexão RTDB continua viva, então o
      // onDisconnect não dispara. Marca offline explicitamente ao trocar/limpar o
      // uid, pra o usuário deslogado não ficar "online" fantasma. (Fechar a aba /
      // crash continua coberto pelo onDisconnect registrado acima.)
      set(statusRef, { state: 'offline', lastChanged: serverTimestamp() }).catch(() => {})
    }
  }, [uid])
}

/**
 * Assina a presença de um peer. Devolve { state, lastChanged } ou null
 * (sem peer / Firebase indisponível / ainda sem dado).
 */
export function usePeerPresence(peerId) {
  const [presence, setPresence] = useState(null)

  useEffect(() => {
    if (!peerId || !isFirebaseReady() || !rtdb) return undefined
    const statusRef = ref(rtdb, `status/${peerId}`)
    const unsub = onValue(statusRef, (snap) => {
      setPresence(snap.exists() ? snap.val() : null)
    })
    // O cleanup limpa a presença ao trocar de peer (evita mostrar a do peer
    // anterior enquanto o onValue do novo ainda não disparou). setState só no
    // callback do onValue e no cleanup — nunca síncrono no corpo do effect.
    return () => {
      unsub()
      setPresence(null)
    }
  }, [peerId])

  return presence
}
