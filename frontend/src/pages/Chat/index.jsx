import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Send from '@mui/icons-material/Send'
import Person from '@mui/icons-material/Person'
import Payments from '@mui/icons-material/Payments'
import Receipt from '@mui/icons-material/Receipt'
import Mic from '@mui/icons-material/Mic'
import StopCircle from '@mui/icons-material/StopCircle'
import Delete from '@mui/icons-material/Delete'

import api from '../../services/api'
import { PageLoader, ButtonSpinner } from '../../components/Spinner'
import GenerateChargeModal from '../../components/GenerateChargeModal'
import Alert from '../../components/ui/Alert'
import { formatCentsBRL } from '../../utils/paymentFees'
import { PAYMENT_ENABLED } from '../../utils/featureFlags'
import { useSocket } from '../../hooks/useSocket'
import { useFirebaseChat } from '../../hooks/useFirebaseChat'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

function normalizeVirlaRole(role) {
  if (role == null) return ''
  return String(role).trim().toUpperCase()
}

export default function Chat() {
  const { userId: peerId } = useParams()
  const navigate = useNavigate()
  const meId = localStorage.getItem('meuId')

  const [peer, setPeer] = useState(null)
  const [myRole, setMyRole] = useState(localStorage.getItem('meuRole') ?? '')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [imgErr, setImgErr] = useState(false)
  const [showChargeModal, setShowChargeModal] = useState(false)
  const [pendingCharge, setPendingCharge] = useState(null)
  const [peerTyping, setPeerTyping] = useState(false)

  const listRef = useRef(null)

  const { isRecording, startRecording, stopRecording, audioBlob, clearAudio } = useAudioRecorder()

  useEffect(() => {
    if (peerId) {
      api.patch(`/messages/read/${peerId}`).catch(err => console.error("Erro ao marcar lidas", err))
    }
  }, [peerId])

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const loadPendingCharge = useCallback(async () => {
    if (!peerId || !PAYMENT_ENABLED) return
    try {
      const res = await api.get(`/payments/charge-requests/pending/${peerId}`)
      setPendingCharge(res.data.charge)
    } catch {
      setPendingCharge(null)
    }
  }, [peerId])

  const fetchHistory = useCallback(async () => {
    const token = localStorage.getItem('meuToken')
    const id = localStorage.getItem('meuId')
    if (!token || !id || !peerId) {
      navigate('/login')
      return null
    }
    const res = await api.get(`/messages/history/${peerId}`)
    setPeer(res.data.peer)
    setMessages(res.data.messages ?? [])
    setImgErr(false)
    return res.data.messages?.length ?? 0
  }, [peerId, navigate])

  useEffect(() => {
    if (!meId || peerId === meId) {
      navigate('/home')
      return
    }
    let cancelled = false
    setLoading(true)
    setPeer(null)
    setMessages([])
    setImgErr(false)
    
    ;(async () => {
      try {
        if (!myRole) {
          const meRes = await api.get(`/users/${meId}`)
          const role = meRes.data.user?.role ?? meRes.data.role
          const roleNorm = normalizeVirlaRole(role)
          if (roleNorm) {
            setMyRole(roleNorm)
            localStorage.setItem('meuRole', roleNorm)
          }
        }
        await fetchHistory()
        await loadPendingCharge()
      } catch (e) {
        if (!cancelled) {
          toast.error('Não foi possível carregar a conversa.')
          navigate(-1)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [meId, peerId, navigate, fetchHistory, loadPendingCharge, myRole])

  const handleIncomingMessage = useCallback((message) => {
    const isRelevant =
      (message.senderId === peerId && message.receiverId === meId) ||
      (message.senderId === meId   && message.receiverId === peerId)
    if (!isRelevant) return

    setMessages((prev) => {
      const exists = prev.some((m) => m.id === message.id)
      if (exists) return prev

      // Com o Firebase, o próprio remetente também recebe o "eco" da mensagem
      // que ele mandou (onChildAdded dispara para todo mundo no chat). Por isso,
      // se for uma mensagem minha, troca a otimista correspondente pela real
      // em vez de duplicar na tela.
      if (message.senderId === meId) {
        const optimisticIndex = prev.findIndex(
          (m) => m._optimistic && m.content === message.content && m.receiverId === message.receiverId
        )
        if (optimisticIndex !== -1) {
          const next = [...prev]
          next[optimisticIndex] = message
          return next
        }
      }

      return [...prev, message]
    })
  }, [peerId, meId])

  const handleTyping = useCallback(({ isTyping }) => {
    setPeerTyping(isTyping)
    if (isTyping) setTimeout(() => setPeerTyping(false), 3000)
  }, [])

  // Atualiza as mensagens na tela para "Lidas" (✓✓)
  const handleReadAck = useCallback(({ readerId }) => {
    if (readerId === peerId) {
      setMessages(prev => prev.map(m => m.senderId === meId ? { ...m, read: true } : m))
    }
  }, [peerId, meId])

  // Sprint 0: a entrega de mensagens em tempo real agora é feita via Firebase
  // Realtime Database (não depende mais de reconexão do Socket.io).
  const { sendMessage: sendFirebaseMessage, markRead: markFirebaseRead, error: firebaseError } = useFirebaseChat({
    meId,
    peerId,
    onMessage: handleIncomingMessage,
  })

  // Socket.io continua de pé apenas para sinais efêmeros: digitando, leitura e status de conexão.
  const { socket, emitTyping, emitRead, isConnected } = useSocket({
    peerId,
    onTyping: handleTyping,
    onReadAck: handleReadAck
  })

  useEffect(() => {
    if (!loading) requestAnimationFrame(scrollToBottom)
  }, [loading, messages, peerTyping, scrollToBottom])

  useEffect(() => {
    if (peerId && isConnected && !loading) emitRead(peerId)
  }, [peerId, isConnected, loading, emitRead])

  useEffect(() => {
    if (peerId && !loading) markFirebaseRead().catch((err) => console.error('Erro ao marcar lidas (Firebase)', err))
  }, [peerId, loading, markFirebaseRead])

  const handleSend = useCallback(async (e) => {
    e.preventDefault()
    
    if (audioBlob) {
      setSending(true)
      try {
        const formData = new FormData()
        formData.append('audio', audioBlob, 'gravacao.webm')
        formData.append('receiverId', peerId)

        const res = await api.post('/messages/audio', formData)
        const novaMensagem = res.data.message

        setMessages((prev) => [...prev, novaMensagem])
        if (socket?.connected) {
          socket.emit('notify_message', { receiverId: peerId, preview: '🎵 Mensagem de Áudio', messageId: novaMensagem.id })
        }

        clearAudio()
      } catch (err) {
        console.error(err)
        toast.error('Não foi possível enviar o áudio.')
      } finally {
        setSending(false)
      }
      return
    }

    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    const optimistic = {
      id: `opt-${Date.now()}`,
      _optimistic: true,
      content: text,
      senderId: meId,
      receiverId: peerId,
      createdAt: new Date().toISOString(),
      read: false
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      await sendFirebaseMessage({ receiverId: peerId, content: text })
      if (socket?.connected) {
        socket.emit('notify_message', { receiverId: peerId, preview: text.slice(0, 30), messageId: optimistic.id })
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      try {
        await api.post('/messages', { receiverId: peerId, content: text })
        await fetchHistory()
      } catch (httpErr) {
        console.error(httpErr)
        toast.error('Não foi possível enviar a mensagem.')
      }
    } finally {
      setSending(false)
    }
  }, [input, sending, meId, peerId, sendFirebaseMessage, fetchHistory, audioBlob, clearAudio, socket])

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value)
    emitTyping(peerId)
  }, [peerId, emitTyping])

  const myRoleNorm = normalizeVirlaRole(myRole)
  const peerRoleNorm = normalizeVirlaRole(peer?.role)
  const isCaregiver = myRoleNorm === 'CUIDADOR'
  const isFamiliar = myRoleNorm === 'FAMILIAR'
  const peerIsCaregiver = peerRoleNorm === 'CUIDADOR'
  const canGenerateCharge = PAYMENT_ENABLED && isCaregiver && !!peer
  const canPay = PAYMENT_ENABLED && isFamiliar && peerIsCaregiver && pendingCharge && pendingCharge.familiarId === meId

  function goToPayment() {
    if (!pendingCharge) return
    navigate('/pagamento', {
      state: {
        amount: pendingCharge.totalAmount,
        baseAmount: pendingCharge.baseAmount,
        description: pendingCharge.description ?? 'Serviço Virla',
        payeeId: pendingCharge.caregiverId,
        chargeRequestId: pendingCharge.id,
      },
    })
  }

  if (loading) {
    return (
      <PageLoader label="Carregando conversa…">
        <div className="w-full max-w-md space-y-3 mt-2">
          <div className="h-12 rounded-xl bg-virla-roxo/10 animate-pulse" />
          <div className="h-20 rounded-xl bg-virla-roxo/5 animate-pulse" />
          <div className="h-20 rounded-xl bg-virla-roxo/5 animate-pulse ml-8" />
        </div>
      </PageLoader>
    )
  }

  return (
    <div className="h-[100dvh] min-h-0 pt-16 bg-[#e8e4ec] flex flex-col">
      {!isConnected && (
        <div className="bg-amber-100 text-amber-800 text-xs text-center py-1 font-medium z-50">
          Sem conexão em tempo real. Mensagens ainda podem ser enviadas; digitando e notificações podem falhar.
        </div>
      )}

      {firebaseError && (
        <div className="px-4 pt-2">
          <Alert tone="warning" title="Modo alternativo de chat">
            {firebaseError} Mensagens continuam via servidor.
          </Alert>
        </div>
      )}

      <header className="flex-shrink-0 z-40 bg-virla-roxo text-white shadow-md px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/15 transition-colors" aria-label="Voltar">
          <ArrowBack sx={{ fontSize: 24 }} />
        </button>
        <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
          {peer?.profileImage && !imgErr ? (
            <img src={peer?.profileImage} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          ) : (
            <Person sx={{ fontSize: 22 }} className="text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-lg truncate">{peer?.name ?? 'Conversa'}</h1>
          <p className="text-xs text-white/70 truncate">
            {peer?.approach || (peerRoleNorm === 'CUIDADOR' ? 'Cuidador' : peerRoleNorm === 'FAMILIAR' ? 'Familiar' : '')}
          </p>
        </div>

        {canGenerateCharge && (
          <button type="button" onClick={() => setShowChargeModal(true)} className="p-2 rounded-xl hover:bg-white/15 transition-colors flex-shrink-0" title="Gerar Cobrança">
            <Receipt sx={{ fontSize: 24 }} />
          </button>
        )}

        {canPay && (
          <button type="button" onClick={goToPayment} className="p-2 rounded-xl hover:bg-white/15 transition-colors flex-shrink-0" title={`Pagar ${formatCentsBRL(pendingCharge.totalAmount)}`}>
            <Payments sx={{ fontSize: 24 }} />
          </button>
        )}

        <Link to="/home?tab=mensagens" className="text-xs font-semibold text-white/90 hover:underline hidden sm:inline">
          Histórico
        </Link>
      </header>

      {canPay && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-900">
          Cobrança pendente: <strong>{formatCentsBRL(pendingCharge.totalAmount)}</strong>
          <button type="button" onClick={goToPayment} className="ml-2 underline font-semibold">Pagar agora</button>
        </div>
      )}

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-6 space-y-3 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <p className="text-center text-sm text-virla-texto/50 py-8">Nenhuma mensagem ainda. Diga olá!</p>
        )}
        
        {messages.map((m) => {
          const mine = m.senderId === meId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-opacity duration-200
                  ${mine ? 'bg-virla-roxo text-white rounded-br-md' : 'bg-white text-virla-texto border border-virla-roxo/10 rounded-bl-md'}
                  ${m._optimistic ? 'opacity-70' : 'opacity-100'}
                `}
              >
                {m.audioUrl ? (
                  <audio src={`${API_URL}${m.audioUrl}`} controls className="max-w-full h-10 mt-1 rounded" />
                ) : (
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                )}
                
                {/* Sistema visual de horário e visualização (✓✓) */}
                <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${mine ? 'text-white/70 justify-end' : 'text-virla-texto/40 justify-start'}`}>
                  {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {mine && !m._optimistic && (
                    <span className={m.read ? 'text-blue-300' : 'text-white/50'}>
                      {m.read ? '✓✓' : '✓'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )
        })}

        {peerTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-virla-roxo/10 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-virla-roxo/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-virla-roxo/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-virla-roxo/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex-shrink-0 bg-white/95 backdrop-blur border-t border-virla-roxo/15 px-4 py-3 shadow-[0_-4px_20px_rgba(128,0,128,0.08)]">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          
          {isRecording ? (
            <div className="flex-1 flex items-center justify-between bg-red-50 rounded-xl px-4 min-h-[44px] border border-red-200">
              <div className="flex items-center gap-2 text-red-600 font-medium animate-pulse">
                <div className="w-2.5 h-2.5 bg-red-600 rounded-full"></div>
                A gravar áudio...
              </div>
              <button type="button" onClick={stopRecording} className="text-red-600 hover:text-red-700 p-2">
                <StopCircle sx={{ fontSize: 28 }} />
              </button>
            </div>
          ) : audioBlob ? (
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-2 min-h-[44px] border border-gray-200">
              <button type="button" onClick={clearAudio} className="text-gray-500 hover:text-red-500 p-2" aria-label="Apagar áudio">
                <Delete sx={{ fontSize: 22 }} />
              </button>
              <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1 h-10" />
            </div>
          ) : (
            <textarea
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              placeholder="Digite uma mensagem…"
              className="flex-1 min-h-[44px] max-h-32 resize-y rounded-xl border border-virla-roxo/20 bg-white px-4 py-3 text-sm text-virla-texto placeholder-virla-texto/40 focus:outline-none focus:ring-2 focus:ring-virla-roxo/30 focus:border-virla-roxo"
            />
          )}

          {(!input.trim() && !audioBlob && !isRecording) ? (
            <button
              type="button"
              onClick={startRecording}
              className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 rounded-xl bg-gray-100 text-virla-roxo flex items-center justify-center hover:bg-gray-200 transition-all"
            >
              <Mic sx={{ fontSize: 24 }} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={sending || (!input.trim() && !audioBlob) || isRecording}
              className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 rounded-xl bg-virla-roxo text-white flex items-center justify-center hover:bg-virla-roxohighlight shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              aria-label="Enviar"
            >
              {sending ? <ButtonSpinner size={22} /> : <Send sx={{ fontSize: 22 }} />}
            </button>
          )}
        </div>
      </form>

      {showChargeModal && canGenerateCharge && (
        <GenerateChargeModal
          key={peerId}
          familiarId={peerId}
          familiarName={peer?.name}
          onClose={() => setShowChargeModal(false)}
          onSuccess={() => loadPendingCharge()}
        />
      )}
    </div>
  )
}