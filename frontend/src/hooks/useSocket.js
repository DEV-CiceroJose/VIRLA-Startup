import { useEffect, useCallback, useRef } from 'react'
import { useSocketContext } from '../context/SocketContext'

export function useSocket({ peerId, onTyping, onReadAck }) {
  const { socket, isConnected } = useSocketContext()
  const typingTimerRef = useRef(null)

  // Estabiliza onTyping em ref para evitar re-subscribe a cada render
  const onTypingRef = useRef(onTyping)
  onTypingRef.current = onTyping

  // Estabiliza onReadAck em ref — corrige bug de re-subscribe desnecessário
  // causado por funções inline recriadas a cada render do componente pai.
  const onReadAckRef = useRef(onReadAck)
  onReadAckRef.current = onReadAck

  useEffect(() => {
    if (!socket) return
    const handleTyping = ({ senderId, isTyping }) => {
      if (senderId === peerId) onTypingRef.current?.({ senderId, isTyping })
    }
    socket.on('peer:typing', handleTyping)
    return () => socket.off('peer:typing', handleTyping)
  }, [socket, peerId]) // onTyping removido — lido via ref

  useEffect(() => {
    if (!socket) return
    const handler = (...args) => onReadAckRef.current?.(...args)
    socket.on('message:read_ack', handler)
    return () => socket.off('message:read_ack', handler)
  }, [socket]) // onReadAck removido — lido via ref, sem re-subscribe desnecessário

  const emitTyping = useCallback(
    (receiverId) => {
      if (!socket || !isConnected) return
      socket.emit('user:typing', { receiverId, isTyping: true })
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        socket.emit('user:typing', { receiverId, isTyping: false })
      }, 2000)
    },
    [socket, isConnected]
  )

  const emitRead = useCallback(
    (senderId) => {
      if (!socket || !isConnected) return
      socket.emit('message:read', { senderId })
    },
    [socket, isConnected]
  )

  useEffect(() => () => clearTimeout(typingTimerRef.current), [])

  return { socket, emitTyping, emitRead, isConnected }
}
