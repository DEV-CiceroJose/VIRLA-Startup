import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Search from '@mui/icons-material/Search'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import Check from '@mui/icons-material/Check'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import api from '../../services/api'
import { calculateAge } from '../../utils/dateUtils'
import { formatHourly } from '../../utils/formatters'
import { PageLoader, LoadingOverlay } from '../../components/Spinner'
import VerifiedSeal from '../../components/VerifiedSeal'
import { Field } from '../../components/ui'
import { specialtyLabel } from '../../constants/specialties'
import '../../design-system/feed.css'

const MAX_TAGS = 4

const LEVEL = {
  EXCELENTE: { label: 'Excelente match', tone: 'ok' },
  ALTA: { label: 'Alta compatibilidade', tone: 'brand' },
  BOA: { label: 'Boa compatibilidade', tone: 'calm' },
  POSSIVEL: { label: 'Compatibilidade possível', tone: 'muted' },
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
}

/** Compatibilidade da solicitação escolhida: número, régua e os motivos. */
function FeedMatch({ match }) {
  if (!match || !Number.isFinite(Number(match.score))) return null
  const score = Math.max(0, Math.min(100, Math.round(Number(match.score))))
  const level = LEVEL[match.level] ?? { label: 'Compatibilidade calculada', tone: 'muted' }
  const reasons = Array.isArray(match.reasons) ? match.reasons.slice(0, 4) : []
  const attention = Array.isArray(match.attention) ? match.attention[0] : null
  const isFallback = match.isFallback === true

  return (
    <section className={`vfd-match tone-${level.tone}`} aria-label={`Compatibilidade de ${score}%`}>
      <div className="vfd-match-head">
        <p className="vfd-match-score"><strong>{score}%</strong> compatível</p>
        <span className="vfd-match-level">{isFallback ? 'Alternativa por baixa oferta' : level.label}</span>
      </div>
      <div className="vfd-meter" aria-hidden="true"><span style={{ width: `${score}%` }} /></div>
      {reasons.length > 0 && (
        <ul className="vfd-reasons">
          {reasons.map((reason) => (
            <li key={reason.code}>
              <Check aria-hidden className="vfd-reason-icon" />
              <span>{reason.label}</span>
              <b>+{reason.points}</b>
            </li>
          ))}
        </ul>
      )}
      {attention && (
        <p className="vfd-attention"><InfoOutlined aria-hidden />{attention}</p>
      )}
      {isFallback && (
        <p className="vfd-attention">Exibida porque há poucas opções com pelo menos 60% de compatibilidade.</p>
      )}
    </section>
  )
}

function UserCard({ user, onOpenChat, viewerIsFamiliar, onVerMais }) {
  const [imgErr, setImgErr] = useState(false)
  const age = calculateAge(user.birthDate)
  const rateLabel = formatHourly(user.hourlyRate)
  const specialties = Array.isArray(user.specialties) ? user.specialties : []
  const place = [user.city, user.state].filter(Boolean).join(', ')
  const firstName = String(user.name ?? '').trim().split(/\s+/)[0] || 'este perfil'
  const isCaregiver = user.role === 'CUIDADOR'
  const summary = user.approach || user.bio
  const showPhoto = user.profileImage && !imgErr
  const canSeeProfile = viewerIsFamiliar && isCaregiver

  return (
    <li className="vfd-card">
      <div className="vfd-top">
        <div className={`vfd-photo${showPhoto ? '' : ' is-initials'}`}>
          {showPhoto ? (
            <img src={user.profileImage} alt="" onError={() => setImgErr(true)} />
          ) : (
            <span aria-hidden>{initials(user.name)}</span>
          )}
        </div>

        <div className="vfd-id">
          <div className="vfd-name-row">
            <h3 className="vfd-name">
              <span>{user.name}</span>
              <VerifiedSeal user={user} iconSize={18} className="vfd-seal" />
            </h3>
            {place && (
              <span className="vfd-place"><PlaceOutlined aria-hidden />{place}</span>
            )}
          </div>
          <p className={summary ? 'vfd-summary' : 'vfd-summary is-empty'}>{summary || 'Perfil profissional'}</p>
          <ul className="vfd-chips" aria-label="Resumo">
            <li className="is-strong">{rateLabel || 'Valor sob consulta'}</li>
            {age !== null && <li>{age} anos</li>}
            {!isCaregiver && <li>Familiar</li>}
          </ul>
        </div>
      </div>

      {specialties.length > 0 && (
        <ul className="vfd-tags" aria-label="Especialidades">
          {specialties.slice(0, MAX_TAGS).map((tag, i) => <li key={`${tag}-${i}`}>{specialtyLabel(tag)}</li>)}
          {specialties.length > MAX_TAGS && <li className="is-more">+{specialties.length - MAX_TAGS}</li>}
        </ul>
      )}

      <FeedMatch match={user.match} />

      <button type="button" className="vfd-cta" onClick={() => onOpenChat(user.id)} aria-label={`Conversar com ${user.name}`}>
        <ChatBubbleOutlineOutlined aria-hidden />
        Conversar com {firstName}
      </button>

      {canSeeProfile && (
        <div className="vfd-more">
          <p>
            <strong>Quer conhecer melhor?</strong>
            <span>Experiência, disponibilidade e como {firstName} trabalha.</span>
          </p>
          <button type="button" className="vfd-more-btn" onClick={() => onVerMais(user.id)}>Ver perfil completo</button>
        </div>
      )}
    </li>
  )
}

export default function Feed() {
  const navigate = useNavigate()
  const [feedUsers, setFeedUsers] = useState([])
  const [loading, setLoading] = useState(true)
  // A busca global da topbar chega como ?busca=termo
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('busca') ?? '')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [fetchError, setFetchError] = useState('')
  const [solicitacoes, setSolicitacoes] = useState([])
  const [selectedSolicitacaoId, setSelectedSolicitacaoId] = useState('')
  const [matchContext, setMatchContext] = useState(null)

  const [myRole, setMyRole] = useState(null)

  const id = localStorage.getItem('meuId')

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    api
      .get(`/users/${id}`)
      .then((res) => {
        const u = res.data.user ?? res.data
        if (!cancelled) setMyRole(u?.role ?? null)
      })
      .catch(() => {
        if (!cancelled) setMyRole(null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    api.get('/solicitacoes/minhas')
      .then((res) => {
        if (cancelled) return
        const active = (res.data.solicitacoes ?? []).filter((item) =>
          ['ABERTA', 'VISUALIZADA', 'EM_ANDAMENTO'].includes(item.status))
        setSolicitacoes(active)
        setSelectedSolicitacaoId((current) => current || active[0]?.id || '')
      })
      .catch(() => {
        if (!cancelled) setSolicitacoes([])
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) {
      navigate('/login')
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        setFetchError('')
        const res = await api.get(`/users/${id}/feed`, {
          params: { page, ...(selectedSolicitacaoId && { solicitacaoId: selectedSolicitacaoId }) },
        })
        if (cancelled) return
        const payload = res.data
        const users = Array.isArray(payload) ? payload : payload.users ?? []
        setFeedUsers(users)
        setTotalPages(typeof payload.totalPages === 'number' ? payload.totalPages : 1)
        setMatchContext(payload.matchContext ?? null)
      } catch (err) {
        console.error(err)
        if (cancelled) return
        const status = err.response?.status
        if (status === 401 || status === 403) {
          localStorage.clear()
          navigate('/login')
          return
        }
        setFeedUsers([])
        setTotalPages(1)
        setMatchContext(null)
        setFetchError('Não foi possível carregar o feed. Tente novamente em instantes.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, navigate, page, selectedSolicitacaoId])

  const filtered = feedUsers.filter((u) => {
    const q = search.toLowerCase()
    const spec = (Array.isArray(u.specialties) ? u.specialties : []).map(specialtyLabel).join(' ').toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.bio?.toLowerCase().includes(q) ||
      u.approach?.toLowerCase().includes(q) ||
      spec.includes(q)
    )
  })

  function goOpenChat(peerId) {
    navigate(`/chat/${peerId}`)
  }

  function goVerMais(peerId) {
    navigate(`/user/${peerId}`)
  }

  const viewerIsFamiliar = myRole === 'FAMILIAR'

  if (loading && feedUsers.length === 0 && !fetchError) {
    return <PageLoader label="Carregando profissionais…" />
  }

  const count = filtered.length
  const countLabel = `${count} ${count === 1 ? 'perfil' : 'perfis'}${search ? ' para essa busca' : ''}`

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash vfd-page">
        {loading && feedUsers.length > 0 && <LoadingOverlay label="Atualizando lista…" />}

        <header className="vd-greeting">
          <h1>Encontre quem cuida</h1>
          <p>Conheça profissionais com calma, veja suas especialidades e converse antes de escolher.</p>
        </header>

        {fetchError && <div role="alert" className="vfd-alert">{fetchError}</div>}

        <div className="vfd-toolbar">
          <label className="vfd-search">
            <Search aria-hidden />
            <span className="sr-only">Buscar profissionais</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, abordagem ou especialidade"
            />
          </label>

          {solicitacoes.length > 0 ? (
            <div className="vfd-match-select">
              <Field
                label="Match inteligente para"
                id="match-solicitacao"
                value={selectedSolicitacaoId}
                onChange={(event) => {
                  setSelectedSolicitacaoId(event.target.value)
                  setPage(1)
                }}
                as="select"
              >
                {solicitacoes.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}
              </Field>
            </div>
          ) : (
            <p className="vfd-toolbar-hint">Publique uma solicitação para receber recomendações personalizadas.</p>
          )}
        </div>

        <div className="vfd-meta">
          <p role="status">
            <strong>{countLabel}</strong>
            {totalPages > 1 && <span> · página {page} de {totalPages}</span>}
          </p>
          {solicitacoes.length > 0 && (
            <p className="vfd-meta-note">
              {matchContext
                ? 'Ordenados por especialidade, localização, valor e qualidade do perfil. A compatibilidade é uma sugestão: confirme os detalhes antes de contratar.'
                : 'Escolha uma solicitação para calcular a compatibilidade.'}
            </p>
          )}
        </div>

        {count === 0 ? (
          <div className="vd-empty vfd-empty">
            <strong>{search ? 'Nenhum perfil encontrado' : 'Nenhum perfil disponível'}</strong>
            <span>
              {search
                ? 'Não há resultados para essa busca nesta página. Tente outro termo.'
                : 'Ainda não há perfis disponíveis no momento. Volte em breve.'}
            </span>
          </div>
        ) : (
          <ul className="vfd-list">
            {filtered.map((u) => (
              <UserCard
                key={`${u.id}-${u.profileImage ?? ''}`}
                user={u}
                onOpenChat={goOpenChat}
                viewerIsFamiliar={viewerIsFamiliar}
                onVerMais={goVerMais}
              />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="vfd-pager" aria-label="Páginas">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft aria-hidden />
              Anterior
            </button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Próxima
              <ChevronRight aria-hidden />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
