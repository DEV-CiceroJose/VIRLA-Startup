import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'
import ArrowForward from '@mui/icons-material/ArrowForward'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import PostAddOutlined from '@mui/icons-material/PostAddOutlined'
import PersonOutline from '@mui/icons-material/PersonOutlined'
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutlined'
import AssignmentTurnedInOutlined from '@mui/icons-material/AssignmentTurnedInOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined'
import Chat from '@mui/icons-material/Chat'
import api from '../../services/api'
import { formatHourly } from '../../utils/formatters'
import { PageLoader, Spinner, InlineSpinner } from '../../components/Spinner'
import VerifiedSeal from '../../components/VerifiedSeal'
import Avatar from '../../components/Avatar'
import { computeCompleteness } from '../../components/ProfileCompleteness/completeness'
import { turnoLabel } from '../../constants/solicitacaoOptions'
import { useNotifications } from '../../context/NotificationContext'
import { notificationText, notificationHref } from '../../utils/notificationsView'

const NOTIFICATION_ICON = {
  MESSAGE: ChatBubbleOutline,
  SOLICITACAO_ASSUMIDA: AssignmentTurnedInOutlined,
  SOLICITACAO_CONCLUIDA: TaskAltOutlined,
  SOLICITACAO_CANCELADA: EventBusyOutlined,
}

const NOTIFICATION_TITLE = {
  MESSAGE: 'Nova mensagem',
  SOLICITACAO_ASSUMIDA: 'Solicitação assumida',
  SOLICITACAO_CONCLUIDA: 'Atendimento concluído',
  SOLICITACAO_CANCELADA: 'Solicitação cancelada',
}

const money = (cents) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format((cents || 0) / 100)

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Agrupa solicitações por data de início (YYYY-MM-DD), em ordem cronológica. */
function groupByDate(requests, maxGroups = 5) {
  const groups = new Map()
  for (const r of requests) {
    const key = r.dataInicio ? String(r.dataInicio).slice(0, 10) : 'sem-data'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'sem-data' ? 1 : b === 'sem-data' ? -1 : a.localeCompare(b)))
    .slice(0, maxGroups)
}

function Sparkles() {
  const star = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z'
  return (
    <svg className="vd-hero-sparkles" viewBox="0 0 160 120" width="160" aria-hidden>
      <path d={star} fill="#fff" transform="translate(70 6) scale(1.4)" />
      <path d={star} fill="#fff" transform="translate(20 70) scale(1)" />
      <path d={star} fill="#fff" transform="translate(112 74) scale(.8)" />
    </svg>
  )
}

function DashboardSkeleton() {
  return (
    <div className="vd-grid animate-pulse" aria-hidden>
      <div className="vd-col">
        <div className="h-28 rounded-[22px] bg-[var(--vd-tint)]" />
        <div className="vd-cards">
          {[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-[20px] bg-[var(--vd-tint)]" />)}
        </div>
        <div className="h-56 rounded-[20px] bg-[var(--vd-tint)]" />
      </div>
      <div className="vd-col">
        <div className="h-72 rounded-[20px] bg-[var(--vd-tint)]" />
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'mensagens' ? 'mensagens' : 'dashboard'

  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [convLoading, setConvLoading] = useState(false)
  const [requests, setRequests] = useState([])
  const [finance, setFinance] = useState(null)
  const { notifications } = useNotifications()

  useEffect(() => {
    const id = localStorage.getItem('meuId')
    if (!id) {
      navigate('/login')
      return
    }

    async function fetchUser() {
      try {
        const res = await api.get(`/users/${id}`)
        const user = res.data.user ?? res.data
        setUserData(user)
        if (user?.name) localStorage.setItem('meuNome', user.name)
      } catch (err) {
        console.error(err)
        const status = err.response?.status
        if (status === 401 || status === 403) localStorage.clear()
        navigate('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate])

  const loadConversations = useCallback(async () => {
    setConvLoading(true)
    try {
      const res = await api.get('/conversations')
      setConversations(res.data.conversations ?? [])
    } catch (e) {
      console.error(e)
      setConversations([])
    } finally {
      setConvLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(loadConversations, 0)
    return () => clearTimeout(t)
  }, [activeTab, loadConversations])

  useEffect(() => {
    if (!userData?.role) return
    let active = true
    const path = userData.role === 'CUIDADOR' ? '/solicitacoes/disponiveis' : '/solicitacoes/minhas'
    api.get(path).then(({ data }) => {
      if (active) setRequests((data.solicitacoes ?? []).filter((item) => !['CONCLUIDA', 'CANCELADA'].includes(item.status)))
    }).catch(() => {})

    // Cuidador: total recebido (pode estar indisponível se pagamentos estiverem desligados).
    if (userData.role === 'CUIDADOR') {
      api.get('/payments/caregiver/summary')
        .then(({ data }) => { if (active) setFinance(data) })
        .catch(() => {})
    }
    return () => { active = false }
  }, [userData?.role])

  const agenda = useMemo(() => groupByDate(requests), [requests])

  if (loading || !userData) {
    return (
      <PageLoader label="Carregando painel…">
        <div className="w-full max-w-5xl mt-2 px-6"><DashboardSkeleton /></div>
      </PageLoader>
    )
  }

  const isCaregiver = userData.role === 'CUIDADOR'
  const firstName = (userData.name ?? '').split(' ')[0]
  const rateLabel = formatHourly(userData.hourlyRate)
  const completeness = computeCompleteness(userData, userData.role)
  const requestsPath = isCaregiver ? '/solicitacoes-disponiveis' : '/solicitacoes'
  const today = todayKey()

  // Conteúdo que muda conforme o perfil (familiar x cuidador).
  const hero = isCaregiver
    ? { title: 'Novas oportunidades', text: 'Solicitações de famílias aguardando um cuidador como você.', cta: 'Ver todas' }
    : { title: 'Pedidos em andamento', text: 'Acompanhe as solicitações de cuidado que você publicou.', cta: 'Ver todos' }

  const statCard = isCaregiver
    ? finance
      ? { value: money(finance.receivedCents), title: 'Total recebido', text: 'Valores de atendimentos confirmados na VIRLA.', cta: 'Ver finanças', to: '/financas' }
      : { value: rateLabel ?? '—', title: 'Seu valor por hora', text: 'Referência exibida para as famílias.', cta: 'Ver finanças', to: '/financas' }
    : { value: String(conversations.length), title: 'Conversas ativas', text: 'Converse com cuidadores e combine os detalhes.', cta: 'Abrir conversas', to: '/home?tab=mensagens' }

  const actionCards = isCaregiver
    ? [
        { icon: SearchOutlined, title: 'Encontrar oportunidades', text: 'Veja solicitações próximas e com o seu perfil.', cta: 'Ver solicitações', to: '/solicitacoes-disponiveis' },
        { icon: PersonOutline, title: 'Seu perfil profissional', text: 'Mantenha especialidades, registro e valores em dia.', cta: 'Editar perfil', to: '/perfil', alt: true },
      ]
    : [
        { icon: SearchOutlined, title: 'Encontrar cuidadores', text: 'Conheça perfis verificados e converse com profissionais.', cta: 'Explorar perfis', to: '/feed' },
        { icon: PostAddOutlined, title: 'Publicar solicitação', text: 'Descreva a necessidade e receba o contato de cuidadores.', cta: 'Meus pedidos', to: '/solicitacoes', alt: true },
      ]

  return (
    <div className="comfort-page comfort-home min-h-screen pt-16">
      <div className="vd-dash">
        <header className="vd-greeting">
          <h1>
            Olá, {firstName}
            <VerifiedSeal user={userData} iconSize={22} className="!text-[#9932CC]" />
          </h1>
          <p>
            {isCaregiver
              ? 'Suas oportunidades, conversas e atendimentos em um só lugar.'
              : 'Tudo o que você precisa para encontrar e acompanhar o cuidado, em um só lugar.'}
          </p>
        </header>

        {/* Cuidador ainda não aprovado: só aparece para famílias depois da verificação */}
        {isCaregiver && userData.verificationStatus !== 'APROVADO' && (
          <Link to="/verificacao" className={`vd-verify-banner${userData.verificationStatus === 'REPROVADO' ? ' is-risk' : userData.verificationStatus === 'EM_ANALISE' ? ' is-wait' : ''}`}>
            <span className="vd-verify-icon"><VerifiedUserOutlined aria-hidden /></span>
            <span>
              <strong>
                {userData.verificationStatus === 'EM_ANALISE'
                  ? 'Seus documentos estão em análise'
                  : userData.verificationStatus === 'REPROVADO'
                    ? 'Sua verificação precisa de ajustes'
                    : 'Verifique seu perfil para receber solicitações'}
              </strong>
              <small>
                {userData.verificationStatus === 'EM_ANALISE'
                  ? 'Avisamos por notificação quando a equipe terminar.'
                  : 'Famílias só encontram cuidadores com documentos e antecedentes conferidos.'}
              </small>
            </span>
            <span className="vd-verify-cta">{userData.verificationStatus === 'EM_ANALISE' ? 'Acompanhar' : 'Verificar agora'}</span>
          </Link>
        )}

        {/* Perfil incompleto — no desktop esse aviso fica no cartão da sidebar */}
        {completeness.percent < 100 && (
          <button
            type="button"
            onClick={() => navigate('/perfil')}
            className="md:hidden mt-5 w-full flex items-center gap-3 p-4 rounded-2xl text-left bg-[var(--vd-tint)] text-[var(--vd-ink)]"
          >
            <span className="font-display font-extrabold text-xl text-virla-roxo">{completeness.percent}%</span>
            <span className="flex-1 text-sm">Complete seu perfil para transmitir mais confiança.</span>
            <ArrowForward fontSize="small" className="text-virla-roxo" />
          </button>
        )}

        {activeTab === 'dashboard' ? (
          <div className="vd-grid">
            <div className="vd-col">
              <section className="vd-hero" aria-labelledby="vd-hero-title">
                <span className="vd-hero-count">{requests.length}</span>
                <div>
                  <h2 id="vd-hero-title">{hero.title}</h2>
                  <p>{hero.text}</p>
                </div>
                <Sparkles />
                <button type="button" className="vd-pill-btn" onClick={() => navigate(requestsPath)}>
                  {hero.cta}
                  <i><ArrowForward sx={{ fontSize: 16 }} /></i>
                </button>
              </section>

              <div className="vd-cards">
                <button type="button" className="vd-card vd-card-dark" onClick={() => navigate(statCard.to)}>
                  <span className="vd-stat">{statCard.value}</span>
                  <h3>{statCard.title}</h3>
                  <p>{statCard.text}</p>
                  <span className="vd-card-link">{statCard.cta} <ArrowForward sx={{ fontSize: 16 }} /></span>
                </button>
                {actionCards.map(({ icon: Icon, title, text, cta, to, alt }) => (
                  <button type="button" className="vd-card" key={to} onClick={() => navigate(to)}>
                    <span className={`vd-card-icon ${alt ? 'alt' : ''}`}><Icon /></span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <span className="vd-card-link">{cta} <ArrowForward sx={{ fontSize: 16 }} /></span>
                  </button>
                ))}
              </div>

              <section aria-labelledby="vd-agenda-title">
                <div className="vd-section-title">
                  <h2 id="vd-agenda-title">{isCaregiver ? 'Oportunidades por data' : 'Sua agenda de cuidados'}</h2>
                  {requests.length > 0 && (
                    <button type="button" className="vd-link-sm" onClick={() => navigate(requestsPath)}>
                      Ver todas <ArrowForward sx={{ fontSize: 15 }} />
                    </button>
                  )}
                </div>

                {agenda.length === 0 ? (
                  <div className="vd-empty">
                    <p>{isCaregiver ? 'Nenhuma solicitação disponível no momento.' : 'Você ainda não tem solicitações em andamento.'}</p>
                    <button type="button" onClick={() => navigate(requestsPath)}>
                      {isCaregiver ? 'Ver solicitações' : 'Publicar uma solicitação'}
                    </button>
                  </div>
                ) : (
                  <div>
                    {agenda.map(([dateKey, items]) => {
                      const date = dateKey === 'sem-data' ? null : new Date(`${dateKey}T12:00:00`)
                      return (
                        <div className="vd-agenda-day" key={dateKey}>
                          <div className={`vd-agenda-date ${dateKey === today ? 'today' : ''}`}>
                            <small>
                              {date
                                ? dateKey === today ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                                : 'A definir'}
                            </small>
                            <strong>{date ? String(date.getDate()).padStart(2, '0') : '—'}</strong>
                          </div>
                          <div className="vd-agenda-items">
                            {items.map((r) => (
                              <button type="button" className="vd-agenda-item" key={r.id} onClick={() => navigate(requestsPath)}>
                                <span className={`vd-agenda-bar s-${r.status}`} aria-hidden />
                                <Avatar name={r.titulo} size={32} radius={10} />
                                <span>
                                  <strong>{r.titulo}</strong>
                                  <small>
                                    {[r.turno ? turnoLabel(r.turno) : null, [r.cidade, r.estado].filter(Boolean).join(', ')]
                                      .filter(Boolean)
                                      .join(' · ') || 'Local a combinar'}
                                  </small>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="vd-col vd-side" aria-label="Atividade recente">
              <section className="vd-panel">
                <div className="vd-panel-head">
                  <h2>Notificações</h2>
                </div>
                {notifications.length === 0 ? (
                  <p className="vd-list-empty">Tudo em dia por aqui.</p>
                ) : notifications.slice(0, 5).map((n) => {
                  const Icon = NOTIFICATION_ICON[n.type] ?? NotificationsNoneOutlined
                  return (
                    <button type="button" className="vd-list-item" key={n.id} onClick={() => navigate(notificationHref(n))}>
                      <span className={`vd-list-icon ${n.read ? '' : 'unread'}`}><Icon /></span>
                      <span className="min-w-0">
                        <strong>{NOTIFICATION_TITLE[n.type] ?? 'Notificação'}</strong>
                        <small>{notificationText(n)}</small>
                      </span>
                    </button>
                  )
                })}
              </section>

              <section className="vd-panel">
                <div className="vd-panel-head">
                  <h2>Mensagens</h2>
                  {conversations.length > 0 && (
                    <button type="button" className="vd-link-sm" onClick={() => navigate('/home?tab=mensagens')}>
                      Ver todas <ArrowForward sx={{ fontSize: 15 }} />
                    </button>
                  )}
                </div>
                {conversations.length === 0 ? (
                  <p className="vd-list-empty">Suas conversas aparecerão aqui.</p>
                ) : conversations.slice(0, 4).map((c) => (
                  <button type="button" className="vd-list-item" key={c.peerId} onClick={() => navigate(`/chat/${c.peerId}`)}>
                    <Avatar name={c.peerName} size={38} radius={10} />
                    <span className="min-w-0">
                      <strong>{c.peerName}</strong>
                      <small>{c.lastMessage}</small>
                    </span>
                  </button>
                ))}
              </section>
            </aside>
          </div>
        ) : (
          <section className="vd-panel mt-7 overflow-hidden" style={{ padding: 0 }} aria-labelledby="vd-conv-title">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--vd-line)]">
              <h2 id="vd-conv-title" className="font-bold text-[var(--vd-ink)] flex items-center gap-2">
                <Chat sx={{ fontSize: 20 }} className="text-virla-roxo" />
                Conversas
              </h2>
              <button
                type="button"
                onClick={loadConversations}
                disabled={convLoading}
                className="vd-link-sm disabled:opacity-50"
              >
                {convLoading && <InlineSpinner size={14} />}
                Atualizar
              </button>
            </div>
            {convLoading && conversations.length === 0 ? (
              <div className="flex justify-center py-16"><Spinner size={28} label="Carregando conversas…" /></div>
            ) : conversations.length === 0 ? (
              <div className="vd-empty m-5">
                <p>Nenhuma conversa ainda.</p>
                <button type="button" onClick={() => navigate(isCaregiver ? '/solicitacoes-disponiveis' : '/feed')}>
                  {isCaregiver ? 'Ver solicitações' : 'Encontrar cuidadores'}
                </button>
              </div>
            ) : (
              <div className="vd-conversations">
                {conversations.map((c) => (
                  <button type="button" className="vd-list-item" key={c.peerId} onClick={() => navigate(`/chat/${c.peerId}`)}>
                    <Avatar name={c.peerName} size={44} radius={12} />
                    <span className="min-w-0 flex-1">
                      <strong>{c.peerName}</strong>
                      <small>{c.lastMessage}</small>
                    </span>
                    <span className="text-xs text-[var(--vd-ink-soft)] shrink-0 pt-1">
                      {c.lastMessageAt
                        ? new Date(c.lastMessageAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                        : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
