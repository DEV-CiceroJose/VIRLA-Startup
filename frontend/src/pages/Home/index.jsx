import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Person from '@mui/icons-material/Person'
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import Cake from '@mui/icons-material/Cake'
import Work from '@mui/icons-material/Work'
import Description from '@mui/icons-material/Description'
import Email from '@mui/icons-material/Email'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Schedule from '@mui/icons-material/Schedule'
import Chat from '@mui/icons-material/Chat'
import Payments from '@mui/icons-material/Payments'
import LocalOffer from '@mui/icons-material/LocalOffer'
import WorkspacePremium from '@mui/icons-material/WorkspacePremium'
import VolunteerActivism from '@mui/icons-material/VolunteerActivism'
import api from '../../services/api'
import { calculateAge, formatDateBR } from '../../utils/dateUtils'
import { formatHourly } from '../../utils/formatters'
import { PageLoader, Spinner, InlineSpinner } from '../../components/Spinner'
import VerifiedSeal from '../../components/VerifiedSeal'
import { specialtyLabel } from '../../constants/specialties'
import { useNotifications } from '../../context/NotificationContext'
import { notificationText } from '../../utils/notificationsView'

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-virla-roxo/10 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-virla-roxo/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon sx={{ fontSize: 18 }} className="text-virla-roxo" />
      </div>
      <div>
        <p className="text-xs text-virla-muted font-medium uppercase tracking-wide">{label}</p>
        <p className="text-virla-texto font-semibold mt-0.5">{value ?? '—'}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
      <div className="h-64 bg-white/60 rounded-2xl border border-virla-roxo/10" />
      <div className="h-64 bg-white/60 rounded-2xl border border-virla-roxo/10" />
      <div className="md:col-span-2 h-40 bg-white/60 rounded-2xl border border-virla-roxo/10" />
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'mensagens' ? 'mensagens' : 'dashboard'

  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [requests, setRequests] = useState([])
  const { notifications } = useNotifications()
  const [convLoading, setConvLoading] = useState(false)
  
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/messages/unread-count')
      setUnreadCount(res.data.count)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 10000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

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
        if (status === 401 || status === 403) {
          localStorage.clear()
          navigate('/login')
        } else {
          navigate('/login')
        }
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
    const t = setTimeout(() => {
      loadConversations()
    }, 0)
    return () => clearTimeout(t)
  }, [activeTab, loadConversations])

  useEffect(() => {
    if (!userData?.role) return
    let active = true
    const path = userData.role === 'CUIDADOR' ? '/solicitacoes/disponiveis' : '/solicitacoes/minhas'
    api.get(path).then(({ data }) => {
      if (active) setRequests((data.solicitacoes ?? []).filter((item) => !['CONCLUIDA', 'CANCELADA'].includes(item.status)).slice(0, 4))
    }).catch(() => {})
    return () => { active = false }
  }, [userData?.role])

  function selectTab(tab) {
    setSearchParams(tab === 'mensagens' ? { tab: 'mensagens' } : {})
  }

  // --- LÓGICA DE VERIFICAÇÃO DE PERFIL COMPLETO ---
  // Analisa se falta alguma informação vital baseado no tipo de conta
  const isProfileIncomplete = () => {
    if (!userData) return false;

    if (userData.role === 'CUIDADOR') {
      return (
        !userData.birthDate ||
        !userData.bio ||
        !userData.profileImage ||
        userData.hourlyRate == null ||
        !userData.council ||
        !userData.city ||
        !userData.state
      );
    }

    if (userData.role === 'FAMILIAR') {
      return (
        !userData.birthDate ||
        !userData.bio ||
        !userData.profileImage
      );
    }

    return false;
  };

  if (loading || !userData) {
    return (
      <PageLoader label="Carregando painel…">
        <div className="w-full max-w-4xl mt-2">
          <DashboardSkeleton />
        </div>
      </PageLoader>
    )
  }

  const age = calculateAge(userData?.birthDate)
  const rateLabel = formatHourly(userData?.hourlyRate)
  const specialties = Array.isArray(userData?.specialties) ? userData.specialties : []
  const showBanner = isProfileIncomplete();

  return (
    <div
      className="comfort-page comfort-home min-h-screen pt-16 bg-virla-neve"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 70% 50% at 70% 0%, rgba(128,0,128,0.08), transparent)',
      }}
    >
      <div className="comfort-content max-w-4xl mx-auto px-6 py-10">
        
        {/* CABEÇALHO ROXO DO PERFIL */}
        <div className="bg-virla-roxo rounded-3xl p-8 text-white mb-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row gap-6 sm:items-center">
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 ring-2 ring-white/30 bg-white/10 flex items-center justify-center">
              {userData?.profileImage ? (
                <img src={userData.profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <Person sx={{ fontSize: 48 }} className="text-white/80" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-sm font-medium mb-1">Bem-vindo de volta,</p>
              <h1
                className="text-3xl font-display font-black tracking-tight inline-flex items-center gap-2 flex-wrap"
              >
                <span>{userData?.name}</span>
                <VerifiedSeal user={userData} className="text-emerald-300" iconSize={24} />
              </h1>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  <CheckCircle sx={{ fontSize: 14 }} />
                  {userData?.role === 'CUIDADOR' ? 'Cuidador Profissional' : 'Familiar'}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  <Schedule sx={{ fontSize: 14 }} />
                  Conta ativa
                </span>
                {rateLabel && (
                  <span className="inline-flex items-center gap-1.5 bg-white/25 rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm">
                    <Payments sx={{ fontSize: 14 }} />
                    {rateLabel}
                  </span>
                )}
              </div>
              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {specialties.slice(0, 6).map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/25"
                    >
                      {specialtyLabel(tag)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================= */}
        {/* BANNER DE GAMIFICAÇÃO / BOAS-VINDAS */}
        {/* ========================================= */}
        {showBanner && userData?.role === 'CUIDADOR' && (
          <div className="bg-virla-roxo/5 backdrop-blur-sm border border-virla-roxo/15 border-l-4 border-l-virla-roxo text-virla-texto p-4 mb-6 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all hover:shadow-md">
            <div className="flex items-start gap-3 flex-1">
              <WorkspacePremium sx={{ fontSize: 24 }} className="text-virla-roxo flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">O seu perfil está incompleto!</p>
                <p className="text-xs mt-1 text-virla-muted">
                  Complete sua foto, apresentação, registro profissional, valor e localização para ajudar famílias a conhecerem melhor seu trabalho.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/perfil')}
              className="w-full sm:w-auto px-5 py-2.5 bg-virla-roxo hover:bg-virla-roxohighlight text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all hover:-translate-y-0.5 whitespace-nowrap"
            >
              Completar Perfil
            </button>
          </div>
        )}

        {showBanner && userData?.role === 'FAMILIAR' && (
          <div className="bg-virla-roxo/5 backdrop-blur-sm border border-virla-roxo/15 border-l-4 border-l-virla-roxo text-virla-texto p-4 mb-6 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all hover:shadow-md">
            <div className="flex items-start gap-3 flex-1">
              <VolunteerActivism sx={{ fontSize: 24 }} className="text-virla-roxo flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">O seu perfil está incompleto!</p>
                <p className="text-xs mt-1 text-virla-muted">
                  Adicione uma foto, sua data de nascimento e uma apresentação detalhada para que os profissionais saibam exatamente como ajudar.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/perfil')}
              className="w-full sm:w-auto px-5 py-2.5 bg-virla-roxo hover:bg-virla-roxohighlight text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all hover:-translate-y-0.5 whitespace-nowrap"
            >
              Completar Perfil
            </button>
          </div>
        )}
        {/* ========================================= */}

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex gap-2 mb-6 p-1 bg-white/60 rounded-2xl border border-virla-roxo/10 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => selectTab('dashboard')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
              ${
                activeTab === 'dashboard'
                  ? 'bg-virla-roxo text-white shadow-md'
                  : 'text-virla-texto/70 hover:text-virla-roxo'
              }`}
          >
            Painel
          </button>
          
          <button
            type="button"
            onClick={() => selectTab('mensagens')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2 relative
              ${
                activeTab === 'mensagens'
                  ? 'bg-virla-roxo text-white shadow-md'
                  : 'text-virla-texto/70 hover:text-virla-roxo'
              }`}
          >
            <Chat sx={{ fontSize: 18 }} />
            Mensagens
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="comfort-dashboard">
            <div className="comfort-quick-actions">
              <button type="button" onClick={() => navigate(userData?.role === 'CUIDADOR' ? '/solicitacoes-disponiveis' : '/feed')}><span>01</span><strong>{userData?.role === 'CUIDADOR' ? 'Encontrar oportunidades' : 'Encontrar cuidadores'}</strong><small>{userData?.role === 'CUIDADOR' ? 'Veja solicitações disponíveis para você.' : 'Conheça perfis e converse com profissionais.'}</small><b>Explorar →</b></button>
              <button type="button" onClick={() => navigate('/home?tab=mensagens')}><span>02</span><strong>Suas conversas</strong><small>Continue falando com as pessoas com quem se conectou.</small><b>Abrir conversas →</b></button>
              <button type="button" onClick={() => navigate(userData?.role === 'CUIDADOR' ? '/financas' : '/solicitacoes')}><span>03</span><strong>{userData?.role === 'CUIDADOR' ? 'Minhas finanças' : 'Meus pedidos'}</strong><small>{userData?.role === 'CUIDADOR' ? 'Acompanhe atendimentos e valores.' : 'Acompanhe as necessidades que você publicou.'}</small><b>Ver detalhes →</b></button>
            </div>
            <div className="comfort-dashboard-activity">
              <section className="comfort-panel">
                <div className="comfort-section-heading"><span className="comfort-eyebrow">Sua rotina</span><h2>{userData?.role === 'CUIDADOR' ? 'Oportunidades para você' : 'Seus pedidos de cuidado'}</h2></div>
                {requests.length === 0 ? <p className="comfort-activity-empty">Nenhuma solicitação por aqui no momento.</p> : requests.map((request) => (
                  <button type="button" className="comfort-request-row" key={request.id} onClick={() => navigate(userData?.role === 'CUIDADOR' ? '/solicitacoes-disponiveis' : '/solicitacoes')}>
                    <span className="comfort-request-date">{request.dataInicio ? new Date(`${String(request.dataInicio).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</span>
                    <span><strong>{request.titulo}</strong><small>{[request.cidade, request.estado].filter(Boolean).join(', ') || 'Local a combinar'}</small></span>
                    <b>→</b>
                  </button>
                ))}
              </section>
              <div className="comfort-dashboard-side">
                <section className="comfort-panel"><div className="comfort-section-heading"><span className="comfort-eyebrow">Acompanhe</span><h2>Notificações</h2></div>{notifications.length === 0 ? <p className="comfort-activity-empty">Tudo em dia por aqui.</p> : notifications.slice(0, 3).map((item) => <p className="comfort-activity-note" key={item.id}>{notificationText(item)}</p>)}</section>
                <section className="comfort-panel"><div className="comfort-section-heading"><span className="comfort-eyebrow">Perto de você</span><h2>Conversas</h2></div>{conversations.length === 0 ? <p className="comfort-activity-empty">Suas conversas aparecerão aqui.</p> : conversations.slice(0, 2).map((item) => <button className="comfort-activity-conversation" type="button" key={item.peerId} onClick={() => navigate(`/chat/${item.peerId}`)}><strong>{item.peerName}</strong><small>{item.lastMessage}</small></button>)}</section>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-virla-roxo/10 shadow-sm p-6">
              <h2 className="font-bold text-virla-texto mb-4 flex items-center gap-2">
                <Person sx={{ fontSize: 20 }} className="text-virla-roxo" />
                Dados pessoais
              </h2>

              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-virla-roxo/15 bg-virla-roxo/5 flex items-center justify-center">
                  {userData?.profileImage ? (
                    <img src={userData.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Person sx={{ fontSize: 40 }} className="text-virla-roxo/30" />
                  )}
                </div>
              </div>

              <InfoRow icon={CalendarMonth} label="Data de nascimento" value={formatDateBR(userData?.birthDate)} />
              <InfoRow icon={Cake} label="Idade" value={age !== null ? `${age} anos` : '—'} />
              <InfoRow
                icon={Work}
                label="Tipo de conta"
                value={userData?.role === 'CUIDADOR' ? 'Cuidador' : 'Familiar'}
              />
              <InfoRow icon={Email} label="E-mail" value={userData?.email} />
              {rateLabel && <InfoRow icon={Payments} label="Valor por hora" value={rateLabel} />}
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-virla-roxo/10 shadow-sm p-6">
              <h2 className="font-bold text-virla-texto mb-4 flex items-center gap-2">
                <Description sx={{ fontSize: 20 }} className="text-virla-roxo" />
                Apresentação
              </h2>
              <p className="text-virla-texto/70 text-sm leading-relaxed whitespace-pre-wrap">
                {userData?.bio || 'Nenhuma bio adicionada ainda. Acesse o Perfil para se apresentar!'}
              </p>
              {specialties.length > 0 && (
                <div className="mt-5 pt-5 border-t border-virla-roxo/10">
                  <p className="text-xs font-semibold text-virla-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                    <LocalOffer sx={{ fontSize: 16 }} className="text-virla-roxo" />
                    Especialidades
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {specialties.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200/80"
                      >
                        {specialtyLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-virla-roxo/10 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-virla-roxo/10 flex items-center justify-between gap-3">
              <h2 className="font-bold text-virla-texto flex items-center gap-2">
                <Chat sx={{ fontSize: 22 }} className="text-virla-roxo" />
                Conversas recentes
              </h2>
              <button
                type="button"
                onClick={loadConversations}
                disabled={convLoading}
                className="text-xs font-semibold text-virla-roxo hover:underline disabled:opacity-50 inline-flex items-center gap-1"
              >
                {convLoading && <InlineSpinner size={14} />}
                Atualizar
              </button>
            </div>
            {convLoading && conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-virla-muted">
                <Spinner size={28} label="Carregando conversas…" />
                <div className="w-full max-w-md space-y-3 px-6 mt-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-virla-roxo/5 animate-pulse" />
                  ))}
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-16 text-center text-virla-muted text-sm">
                Nenhuma conversa ainda. Visite o{' '}
                <button
                  type="button"
                  className="text-virla-roxo font-semibold underline"
                  onClick={() =>
                    navigate(
                      localStorage.getItem('meuRole') === 'CUIDADOR' ? '/solicitacoes-disponiveis' : '/feed',
                    )
                  }
                >
                  {localStorage.getItem('meuRole') === 'CUIDADOR' ? 'Solicitações' : 'Feed'}
                </button>{' '}
                e envie uma mensagem.
              </div>
            ) : (
              <ul className="divide-y divide-virla-roxo/10">
                {conversations.map((c) => (
                  <li key={c.peerId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/chat/${c.peerId}`)}
                      className="w-full text-left px-6 py-4 hover:bg-virla-roxo/5 transition-colors flex gap-4"
                    >
                      <div className="w-11 h-11 rounded-xl bg-virla-roxo/10 flex items-center justify-center flex-shrink-0">
                        <Person sx={{ fontSize: 24 }} className="text-virla-roxo" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-virla-texto truncate">{c.peerName}</p>
                        <p className="text-sm text-virla-texto/60 truncate mt-0.5">{c.lastMessage}</p>
                      </div>
                      <span className="text-xs text-virla-texto/40 flex-shrink-0 pt-1">
                        {c.lastMessageAt
                          ? new Date(c.lastMessageAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
