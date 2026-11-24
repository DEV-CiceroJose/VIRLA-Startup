import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Send from '@mui/icons-material/Send'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import Payments from '@mui/icons-material/Payments'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import Mic from '@mui/icons-material/Mic'
import StopCircle from '@mui/icons-material/StopCircle'
import Delete from '@mui/icons-material/Delete'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ExitToApp from '@mui/icons-material/ExitToApp'
import AttachFile from '@mui/icons-material/AttachFile'
import PictureAsPdf from '@mui/icons-material/PictureAsPdf'
import InsertDriveFile from '@mui/icons-material/InsertDriveFile'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import AddCommentOutlined from '@mui/icons-material/AddCommentOutlined'
import WifiOffOutlined from '@mui/icons-material/WifiOffOutlined'

import api from '../../services/api'
import EmojiPicker from '../../components/EmojiPicker'
import Avatar from '../../components/Avatar'
import { ButtonSpinner } from '../../components/Spinner'
import GenerateChargeModal from '../../components/GenerateChargeModal'
import { ConfirmDialog } from '../../components/ui'
import { formatCentsBRL } from '../../utils/paymentFees'
import { LEGACY_CHAT_PAYMENT_ENABLED as PAYMENT_ENABLED } from '../../utils/featureFlags'
import { canDeleteMessage, mergeMessageById } from '../../utils/chatMessages'
import { useSocket } from '../../hooks/useSocket'
import { useFirebaseChat } from '../../hooks/useFirebaseChat'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { usePeerPresence } from '../../hooks/usePresence'
import { formatLastSeen } from '../../utils/lastSeen'
import { useNotifications } from '../../context/NotificationContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'
const ATTACHMENT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

function normalizeVirlaRole(role) {
  if (role == null) return ''
  return String(role).trim().toUpperCase()
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Rótulo do separador de dia: Hoje, Ontem ou a data. */
function dayLabel(date) {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, now)) return 'Hoje'
  if (sameDay(date, yesterday)) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

/** Horário na lista de conversas: hora se for hoje, senão dd/mm. */
function listTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return sameDay(date, new Date())
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function Chat() {
  const { userId: peerId } = useParams()
  const navigate = useNavigate()
  const meId = localStorage.getItem('meuId')
  const peerPresence = usePeerPresence(peerId)
  const { markConversationRead, notifications = [] } = useNotifications()
  const [listFilter, setListFilter] = useState('todas')
  const [listQuery, setListQuery] = useState('')

  const [peer, setPeer] = useState(null)
  const [conversations, setConversations] = useState([])
  const [myRole, setMyRole] = useState(localStorage.getItem('meuRole') ?? '')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [imgErr, setImgErr] = useState(false)
  const [showChargeModal, setShowChargeModal] = useState(false)
  const [pendingCharge, setPendingCharge] = useState(null)
  const [peerTyping, setPeerTyping] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingMsg, setDeletingMsg] = useState(false)
  const [activeMsgId, setActiveMsgId] = useState(null) // bolha "aberta" que mostra a lixeira
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)

  const listRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    let active = true
    api.get('/conversations').then(({ data }) => {
      if (active) setConversations(data.conversations ?? [])
    }).catch(() => {})
    return () => { active = false }
  }, [peerId, messages.length])

  const { isRecording, startRecording, stopRecording, audioBlob, clearAudio } = useAudioRecorder()

  useEffect(() => {
    if (peerId) {
      api.patch(`/messages/read/${peerId}`).catch(err => console.error("Erro ao marcar lidas", err))
      markConversationRead(peerId)
    }
  }, [peerId, markConversationRead])

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
    const id = localStorage.getItem('meuId')
    if (!id || !peerId) {
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
        // CORREÇÃO: antes redirecionava para /feed (que, para cuidadores,
        // jogava de volta para a lista de solicitações — parecia que o botão
        // "Conversar" não fazia nada). Agora avisa e volta uma página.
        if (!cancelled) {
          toast.error('Não foi possível carregar a conversa. Tente novamente.')
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

  const handleChangedMessage = useCallback((message) => {
    setMessages((prev) => mergeMessageById(prev, message))
  }, [])

  // Sprint 0: a entrega de mensagens em tempo real agora é feita via Firebase
  // Realtime Database (não depende mais de reconexão do Socket.io).
  const { sendMessage: sendFirebaseMessage, markRead: markFirebaseRead, realtimeActive } = useFirebaseChat({
    meId,
    peerId,
    onMessage: handleIncomingMessage,
    onMessageChanged: handleChangedMessage,
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

  // Modo de contingência (correção do chat): se o tempo real do Firebase não
  // estiver ativo (serviço de Auth desativado / sem config), busca o histórico
  // por HTTP a cada 4s para a conversa continuar atualizando mesmo assim.
  useEffect(() => {
    if (loading || realtimeActive) return
    const intervalId = setInterval(() => {
      fetchHistory().catch(() => { /* silencioso: erro já tratado no carregamento */ })
    }, 4000)
    return () => clearInterval(intervalId)
  }, [loading, realtimeActive, fetchHistory])

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
        // Aviso leve via socket para acionar toast/som em outras telas do destinatário
        // (o conteúdo em si já foi persistido no Firebase pelo backend).
        socket.emit('notify_message', { receiverId: peerId, preview: '🎵 Mensagem de Áudio', messageId: novaMensagem.id })

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
      socket.emit('notify_message', { receiverId: peerId, preview: text.slice(0, 30), messageId: optimistic.id })
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

  const handlePickFile = useCallback((e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo depois
    if (!file) return
    if (!ATTACHMENT_MIMES.includes(file.type)) {
      toast.warning('Envie imagem (JPG/PNG/WEBP/GIF) ou PDF.')
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.warning('Arquivo muito grande (máx. 5MB).')
      return
    }
    setPendingFile(file)
  }, [])

  const handleSendAttachment = useCallback(async () => {
    if (!pendingFile || sending) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('receiverId', peerId)
      const res = await api.post('/messages/attachment', formData)
      const novaMensagem = res.data.message
      setMessages((prev) => [...prev, novaMensagem])
      socket.emit('notify_message', { receiverId: peerId, preview: '📎 Anexo', messageId: novaMensagem.id })
      setPendingFile(null)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível enviar o anexo.')
    } finally {
      setSending(false)
    }
  }, [pendingFile, sending, peerId, socket])

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value)
    emitTyping(peerId)
  }, [peerId, emitTyping])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return
    setDeletingMsg(true)
    try {
      await api.delete(`/messages/${peerId}/${confirmDeleteId}`)
      // O tombstone ao vivo chega via onChildChanged; atualiza otimista também:
      setMessages((prev) => mergeMessageById(prev, { id: confirmDeleteId, deleted: true, content: '', audioUrl: null }))
    } catch (err) {
      const msg = err.response?.status === 409
        ? 'O prazo para apagar esta mensagem já passou.'
        : 'Não foi possível apagar a mensagem.'
      toast.error(msg)
    } finally {
      setDeletingMsg(false)
      setConfirmDeleteId(null)
      setActiveMsgId(null)
    }
  }, [confirmDeleteId, peerId])

  const handleConfirmLeave = useCallback(async () => {
    setLeaving(true)
    try {
      await api.patch(`/conversations/${peerId}/archive`, { archived: true })
      navigate('/home?tab=mensagens')
    } catch {
      toast.error('Não foi possível sair da conversa.')
      setLeaving(false)
      setConfirmLeave(false)
    }
  }, [peerId, navigate])

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

  // Mensagens não lidas por conversa, a partir das notificações do tipo MESSAGE.
  const unreadByPeer = {}
  for (const n of notifications) {
    if (n.type === 'MESSAGE' && !n.read && n.senderId) {
      unreadByPeer[n.senderId] = (unreadByPeer[n.senderId] ?? 0) + (n.count ?? 1)
    }
  }
  const unreadConversations = conversations.filter((c) => unreadByPeer[c.peerId] && c.peerId !== peerId)
  const term = listQuery.trim().toLowerCase()
  const visibleConversations = (listFilter === 'naolidas' ? unreadConversations : conversations)
    .filter((c) => !term || `${c.peerName ?? ''} ${c.lastMessage ?? ''}`.toLowerCase().includes(term))

  const peerRoleLabel = peerRoleNorm === 'CUIDADOR' ? 'Cuidador' : peerRoleNorm === 'FAMILIAR' ? 'Familiar' : ''

  return (
    <div className="vc-chat">
      <aside className="vc-list" aria-label="Conversas">
        <div className="vc-list-head">
          <h2>Conversas</h2>
          <button
            type="button"
            className="vc-icon-btn brand"
            onClick={() => navigate(isCaregiver ? '/solicitacoes-disponiveis' : '/feed')}
            aria-label={isCaregiver ? 'Encontrar oportunidades' : 'Encontrar cuidadores'}
            title={isCaregiver ? 'Encontrar oportunidades' : 'Encontrar cuidadores'}
          >
            <AddCommentOutlined sx={{ fontSize: 20 }} />
          </button>
        </div>
        <label className="vc-list-search">
          <SearchOutlined sx={{ fontSize: 18 }} aria-hidden />
          <input
            type="search"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="Buscar conversas…"
            aria-label="Buscar conversas"
          />
        </label>
        <div className="vc-tabs" role="tablist" aria-label="Filtrar conversas">
          <button type="button" role="tab" className="vc-tab" aria-selected={listFilter === 'todas'} onClick={() => setListFilter('todas')}>
            Todas <span className="vc-count muted">{conversations.length}</span>
          </button>
          <button type="button" role="tab" className="vc-tab" aria-selected={listFilter === 'naolidas'} onClick={() => setListFilter('naolidas')}>
            Não lidas <span className={`vc-count ${unreadConversations.length ? '' : 'muted'}`}>{unreadConversations.length}</span>
          </button>
        </div>
        <div className="vc-list-items">
          {visibleConversations.length === 0 && (
            <p className="vc-list-empty">
              {conversations.length === 0 ? 'Suas conversas aparecerão aqui.' : 'Nenhuma conversa encontrada.'}
            </p>
          )}
          {visibleConversations.map((conversation) => {
            const active = conversation.peerId === peerId
            const unread = active ? 0 : unreadByPeer[conversation.peerId] ?? 0
            return (
              <Link
                key={conversation.peerId}
                to={`/chat/${conversation.peerId}`}
                aria-current={active ? 'page' : undefined}
                className={`vc-item ${active ? 'active' : ''} ${unread ? 'unread' : ''}`}
              >
                <Avatar src={conversation.peerImage} name={conversation.peerName} size={44} radius={50} />
                <span className="vc-item-body">
                  <span className="vc-item-top">
                    <strong>{conversation.peerName}</strong>
                    <time>{listTime(conversation.lastMessageAt)}</time>
                  </span>
                  <span className="vc-item-bottom">
                    <p>{conversation.lastMessage || 'Inicie a conversa'}</p>
                    {unread > 0 && <span className="vc-count">{unread > 9 ? '9+' : unread}</span>}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </aside>

      <section className="vc-pane" aria-label="Conversa">
        <header className="vc-head">
          <button type="button" onClick={() => navigate('/home?tab=mensagens')} className="vc-icon-btn vc-back" aria-label="Voltar">
            <ArrowBack sx={{ fontSize: 22 }} />
          </button>
          <Avatar src={imgErr ? null : peer?.profileImage} name={peer?.name ?? ''} size={44} radius={50} />
          {peer?.profileImage && !imgErr && (
            <img src={peer.profileImage} alt="" hidden onError={() => setImgErr(true)} />
          )}
          <div className="vc-head-info">
            <h1>{peer?.name ?? (loading ? 'Carregando…' : 'Conversa')}</h1>
            {peerPresence?.state === 'online' ? (
              <p><span className="vc-online-dot" aria-hidden />online</p>
            ) : peerPresence?.lastChanged ? (
              <p>visto por último {formatLastSeen(peerPresence.lastChanged)}</p>
            ) : (
              <p>{peer?.approach || peerRoleLabel}</p>
            )}
          </div>
          {peer && peerRoleLabel && peer?.approach && <span className="vc-chip">{peerRoleLabel}</span>}

          <div className="vc-head-actions">
            {peer && (
              <Link to={`/user/${peerId}`} className="vc-head-action" title="Ver perfil">
                <PersonOutlined aria-hidden /><span className="label">Ver perfil</span>
              </Link>
            )}
            {canGenerateCharge && (
              <button type="button" onClick={() => setShowChargeModal(true)} className="vc-head-action" title="Gerar Cobrança">
                <ReceiptLongOutlined aria-hidden /><span className="label">Cobrança</span>
              </button>
            )}
            {canPay && (
              <button type="button" onClick={goToPayment} className="vc-head-action" title={`Pagar ${formatCentsBRL(pendingCharge.totalAmount)}`}>
                <Payments aria-hidden /><span className="label">Pagar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="vc-head-action"
              title="Sair da conversa"
              aria-label="Sair da conversa"
            >
              <ExitToApp aria-hidden /><span className="label">Sair</span>
            </button>
          </div>
        </header>

        {!isConnected && (
          <div className="vc-banner warn" role="status">
            <WifiOffOutlined sx={{ fontSize: 16, mr: 0.75, verticalAlign: '-3px' }} aria-hidden />
            Sem conexão. Reconectando ao servidor...
          </div>
        )}

        {canPay && (
          <div className="vc-banner warn">
            Cobrança pendente: <strong>{formatCentsBRL(pendingCharge.totalAmount)}</strong>
            <button type="button" onClick={goToPayment}>Pagar agora</button>
          </div>
        )}

        {loading ? (
          <div className="vc-messages" aria-busy="true">
            <div className="vc-skeleton" role="status" aria-label="Carregando conversa…">
              <div /><div /><div /><div />
            </div>
          </div>
        ) : (
          <div ref={listRef} className="vc-messages">
            {messages.length === 0 && (
              <p className="vc-empty-msg">Nenhuma mensagem ainda. Diga olá!</p>
            )}

            {messages.map((m, index) => {
              const mine = m.senderId === meId
              const deletable = mine && canDeleteMessage(m, meId)
              const created = new Date(m.createdAt)
              const prev = index > 0 ? new Date(messages[index - 1].createdAt) : null
              const showDay = !Number.isNaN(created.getTime()) && (!prev || !sameDay(prev, created))
              return (
                <div key={m.id}>
                  {showDay && <div className="vc-day"><span>{dayLabel(created)}</span></div>}
                  <div className={`vc-row ${mine ? 'mine' : ''}`}>
                    <div
                      onClick={() => deletable && setActiveMsgId((cur) => (cur === m.id ? null : m.id))}
                      className={`vc-bubble ${m._optimistic ? 'optimistic' : ''} ${deletable ? 'clickable' : ''}`}
                    >
                      {m.deleted ? (
                        <p className="italic opacity-70">🚫 Esta mensagem foi apagada</p>
                      ) : m.attachmentType === 'image' ? (
                        <a href={`${API_URL}${m.attachmentUrl}`} target="_blank" rel="noreferrer">
                          <img
                            src={`${API_URL}${m.attachmentUrl}`}
                            alt={m.attachmentName || 'imagem'}
                            className="max-w-full max-h-64 rounded-lg"
                          />
                        </a>
                      ) : m.attachmentType === 'pdf' ? (
                        <a
                          href={`${API_URL}${m.attachmentUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 underline"
                        >
                          <InsertDriveFile sx={{ fontSize: 20 }} />
                          {m.attachmentName || 'documento.pdf'}
                        </a>
                      ) : m.audioUrl ? (
                        <audio src={`${API_URL}${m.audioUrl}`} controls className="max-w-full h-10 mt-1 rounded" />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      )}

                      {!m.deleted && (
                        <p className="vc-meta">
                          {created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {mine && !m._optimistic && (
                            <span className={`vc-tick ${m.read ? 'read' : ''}`} aria-label={m.read ? 'Lida' : 'Enviada'}>
                              {m.read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </p>
                      )}

                      {deletable && activeMsgId === m.id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(m.id) }}
                          className="vc-delete"
                          aria-label="Apagar mensagem"
                        >
                          <DeleteOutlined sx={{ fontSize: 16 }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {peerTyping && (
              <div className="vc-row">
                <div className="vc-bubble vc-typing" aria-label="Digitando">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSend} className="vc-composer">
          {!isRecording && !audioBlob && !pendingFile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handlePickFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="vc-icon-btn"
                aria-label="Anexar arquivo"
              >
                <AttachFile sx={{ fontSize: 22 }} />
              </button>
            </>
          )}

          {!isRecording && !audioBlob && (
            <EmojiPicker buttonClassName="vc-icon-btn" onSelect={(emoji) => setInput((v) => v + emoji)} />
          )}

          {isRecording ? (
            <div className="vc-staged recording">
              <span className="flex-1 flex items-center gap-2 font-medium animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-current" aria-hidden />
                A gravar áudio...
              </span>
              <button type="button" onClick={stopRecording} className="p-1" aria-label="Parar gravação">
                <StopCircle sx={{ fontSize: 26 }} />
              </button>
            </div>
          ) : audioBlob ? (
            <div className="vc-staged">
              <button type="button" onClick={clearAudio} className="vc-icon-btn" aria-label="Apagar áudio">
                <Delete sx={{ fontSize: 20 }} />
              </button>
              <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1 h-10" />
            </div>
          ) : pendingFile ? (
            <div className="vc-staged">
              <button type="button" onClick={() => setPendingFile(null)} className="vc-icon-btn" aria-label="Cancelar anexo">
                <Delete sx={{ fontSize: 20 }} />
              </button>
              {pendingFile.type === 'application/pdf' ? (
                <PictureAsPdf sx={{ fontSize: 22 }} className="text-red-600" />
              ) : (
                <img src={URL.createObjectURL(pendingFile)} alt={pendingFile.name} className="h-9 w-9 object-cover rounded" />
              )}
              <span className="truncate flex-1 text-[var(--vd-ink-soft)]">{pendingFile.name}</span>
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
              className="vc-input"
            />
          )}

          {pendingFile ? (
            <button
              type="button"
              onClick={handleSendAttachment}
              disabled={sending}
              className="vc-send"
              aria-label="Enviar anexo"
            >
              {sending ? <ButtonSpinner size={20} /> : <Send sx={{ fontSize: 20 }} />}
            </button>
          ) : (!input.trim() && !audioBlob && !isRecording) ? (
            <button
              type="button"
              onClick={startRecording}
              className="vc-send"
              aria-label="Gravar áudio"
            >
              <Mic sx={{ fontSize: 22 }} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={sending || (!input.trim() && !audioBlob) || isRecording}
              className="vc-send"
              aria-label="Enviar"
            >
              {sending ? <ButtonSpinner size={20} /> : <Send sx={{ fontSize: 20 }} />}
            </button>
          )}
        </form>
      </section>

      {showChargeModal && canGenerateCharge && (
        <GenerateChargeModal
          key={peerId}
          familiarId={peerId}
          familiarName={peer?.name}
          onClose={() => setShowChargeModal(false)}
          onSuccess={() => loadPendingCharge()}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Apagar mensagem?"
        description="Ela aparecerá como apagada para você e para a outra pessoa."
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        loading={deletingMsg}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Sair desta conversa?"
        description="Ela sai da sua lista de conversas; a outra pessoa continua vendo, e você não perde o histórico."
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        loading={leaving}
        onConfirm={handleConfirmLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  )
}
