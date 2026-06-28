import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { socket } from '../services/socket'
import { playNotificationSound, showBrowserNotification } from '../utils/notifications'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [transport, setTransport] = useState('—')
  const [connectionError, setConnectionError] = useState(null)

  useEffect(() => {
    const userId = localStorage.getItem('meuId')
    if (!userId) return

    let mounted = true

    try {
      socket.connect()
    } catch (err) {
      console.error('[Socket] Falha ao iniciar conexão:', err)
      if (mounted) setConnectionError(err.message ?? 'Falha ao conectar ao servidor')
      return
    }

    const onConnect = () => {
      if (!mounted) return
      setIsConnected(true)
      setConnectionError(null)
      setTransport(socket.io.engine.transport.name)
      socket.io.engine.on('upgrade', (t) => setTransport(t.name))
    }

    const onDisconnect = () => {
      if (!mounted) return
      setIsConnected(false)
      setTransport('—')
    }

    const onConnectError = (err) => {
      console.error('[Socket] Connection error:', err.message)
      if (!mounted) return
      setConnectionError(err.message ?? 'Erro de conexão')
      setIsConnected(false)
    }

    // --- MÁGICA DAS NOTIFICAÇÕES GLOBAIS ---
    // Sprint 0: o conteúdo das mensagens agora vive no Firebase RTDB. Este
    // evento de socket é só um "toque de campainha" leve (sem persistir nada)
    // para acionar som/toast mesmo fora da tela daquele chat específico.
    const onReceiveMessageNotify = ({ senderId, preview }) => {
      if (senderId === userId) return; // Ignora se fui eu mesmo que mandei

      const currentPath = window.location.pathname;
      const isChattingWithSender = currentPath === `/chat/${senderId}`;

      // Se a janela estiver fora de foco OU o usuário não estiver na tela do chat específico
      if (!document.hasFocus() || !isChattingWithSender) {
        playNotificationSound() // Toca o Plim!

        if (!document.hasFocus()) {
          showBrowserNotification({ senderId, content: preview }) // Notificação nativa do Windows/Mac/Android
        } else {
          // Toast elegante dentro do aplicativo
          toast.info('Nova mensagem', {
            description: preview?.length > 30 ? preview.substring(0, 30) + '...' : preview,
            action: {
              label: 'Abrir Chat',
              onClick: () => window.location.href = `/chat/${senderId}`
            }
          })
        }
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('receive_message_notify', onReceiveMessageNotify) // Escuta o "toque de campainha" de qualquer lugar!

    return () => {
      mounted = false
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('receive_message_notify', onReceiveMessageNotify)
      socket.disconnect()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected, transport, connectionError }}>
      {children}
    </SocketContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSocketContext() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocketContext must be used inside <SocketProvider>')
  return ctx
}