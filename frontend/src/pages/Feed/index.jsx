import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Person from '@mui/icons-material/Person'
import Groups from '@mui/icons-material/Groups'
import Search from '@mui/icons-material/Search'
import Handshake from '@mui/icons-material/Handshake'
import Chat from '@mui/icons-material/Chat'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import Work from '@mui/icons-material/Work'
import Cake from '@mui/icons-material/Cake'
import api from '../../services/api'
import { calculateAge } from '../../utils/dateUtils'
import { formatHourly } from '../../utils/formatters'
import { PageLoader, LoadingOverlay } from '../../components/Spinner'
import VerifiedSeal from '../../components/VerifiedSeal'
import { EmptyState, Alert } from '../../components/ui'

function RoleBadge({ role }) {
  const isCuidador = role === 'CUIDADOR'
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
      ${isCuidador ? 'bg-virla-roxo/10 text-virla-roxo' : 'bg-blue-50 text-blue-600'}`}
    >
      <Work sx={{ fontSize: 12 }} />
      {isCuidador ? 'Cuidador' : 'Familiar'}
    </span>
  )
}

function UserCard({ user, onOpenChat, viewerIsFamiliar, onVerMais }) {
  const age = calculateAge(user.birthDate)
  const rateLabel = formatHourly(user.hourlyRate)
  const specialties = Array.isArray(user.specialties) ? user.specialties : []
  const [imgErr, setImgErr] = useState(false)

  return (
    <li
      className="bg-white/90 backdrop-blur-sm rounded-2xl border border-virla-roxo/10 shadow-sm p-5
                 hover:shadow-md hover:border-virla-roxo/20 transition-all duration-200 flex flex-col gap-4"
    >
      <div className="flex gap-4">
        <div
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-virla-roxo/12 to-violet-100/50 ring-1 ring-virla-roxo/10 flex items-center justify-center"
        >
          {user.profileImage && !imgErr ? (
            <img
              src={user.profileImage}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgErr(true)}
            />
          ) : (
            <Person sx={{ fontSize: 40 }} className="text-virla-roxo/35" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-virla-texto truncate inline-flex items-center gap-1 max-w-full">
            <span className="truncate">{user.name}</span>
            <VerifiedSeal user={user} iconSize={18} />
          </h3>
          {user.approach ? (
            <p className="text-sm text-virla-texto/55 mt-0.5 line-clamp-2">{user.approach}</p>
          ) : (
            <p className="text-sm text-virla-texto/40 mt-0.5 italic">Perfil profissional</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <RoleBadge role={user.role} />
            {age !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-virla-texto/60">
                <Cake sx={{ fontSize: 14 }} className="text-virla-roxo/50" />
                {age} anos
              </span>
            )}
          </div>
        </div>
      </div>

      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {specialties.slice(0, 8).map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-100/95 text-violet-800 border border-violet-200/90"
            >
              {tag}
            </span>
          ))}
          {specialties.length > 8 && (
            <span className="text-[11px] text-virla-texto/45 px-2 py-1 self-center">
              +{specialties.length - 8}
            </span>
          )}
        </div>
      )}

      {user.bio && (
        <p className="text-sm text-virla-texto/65 line-clamp-2 border-l-2 border-virla-roxo/20 pl-3">
          {user.bio}
        </p>
      )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-virla-roxo/10">
          <div className="min-h-[1.5rem] flex items-center">
            {rateLabel ? (
              <div>
                <p className="text-[10px] font-semibold text-virla-texto/45 uppercase tracking-wider">
                  Consulta / hora
                </p>
                <p className="text-xl font-black text-virla-roxo tracking-tight">{rateLabel}</p>
              </div>
            ) : (
              <p className="text-xs text-virla-texto/45">Valor sob consulta</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChat(user.id)}
              aria-label="Abrir chat com este usuário"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-virla-roxo text-white text-sm font-semibold
                         hover:bg-virla-roxohighlight shadow-md transition-all sm:min-w-[180px]"
            >
              <Chat sx={{ fontSize: 18 }} />
              Enviar mensagem
            </button>
            {viewerIsFamiliar && user.role === 'CUIDADOR' && (
              <button
                type="button"
                onClick={() => onVerMais(user.id)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-virla-roxo text-virla-roxo text-sm font-semibold
                           bg-transparent hover:bg-virla-roxo/10 transition-all sm:min-w-[140px]"
              >
                Ver mais
              </button>
            )}
          </div>
        </div>
    </li>
  )
}

export default function Feed() {
  const navigate = useNavigate()
  const [feedUsers, setFeedUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fetchError, setFetchError] = useState('')

  const [myRole, setMyRole] = useState(null)

  const id = localStorage.getItem('meuId')

  useEffect(() => {
    const token = localStorage.getItem('meuToken')
    if (!token || !id) return undefined
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
    const token = localStorage.getItem('meuToken')
    if (!token || !id) {
      navigate('/login')
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        setFetchError('')
        const res = await api.get(`/users/${id}/feed`, { params: { page } })
        if (cancelled) return
        const payload = res.data
        const users = Array.isArray(payload) ? payload : payload.users ?? []
        setFeedUsers(users)
        setTotal(typeof payload.total === 'number' ? payload.total : users.length)
        setTotalPages(typeof payload.totalPages === 'number' ? payload.totalPages : 1)
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
        setTotal(0)
        setTotalPages(1)
        setFetchError('Não foi possível carregar o feed. Tente novamente em instantes.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, navigate, page])

  const filtered = feedUsers.filter((u) => {
    const q = search.toLowerCase()
    const spec = (Array.isArray(u.specialties) ? u.specialties : []).join(' ').toLowerCase()
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

  return (
    <div
      className="min-h-screen pt-16 bg-virla-neve"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 40% at 80% 10%, rgba(128,0,128,0.08), transparent)',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-10 pb-28 relative">
        {loading && feedUsers.length > 0 && <LoadingOverlay label="Atualizando lista…" />}

        {fetchError && (
          <Alert tone="error" className="mb-6">
            {fetchError}
          </Alert>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Handshake sx={{ fontSize: 32 }} className="text-virla-roxo" />
            <h1
              className="text-3xl font-display font-black text-virla-roxo"
            >
              Profissionais
            </h1>
          </div>
          <p className="text-virla-muted text-sm">
            {total} perfil{total !== 1 ? 'is' : ''} no total
            {totalPages > 1 && ` · página ${page} de ${totalPages}`}
          </p>
        </div>

        <div className="relative mb-6">
          <Search
            sx={{ fontSize: 18 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-virla-roxo/40 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, abordagem ou especialidades…"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-virla-roxo/20 bg-white/80
                       text-virla-texto placeholder-virla-texto/40 text-sm
                       focus:outline-none focus:ring-2 focus:ring-virla-roxo/30 focus:border-virla-roxo
                       transition-all duration-200 shadow-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Groups}
            title={search ? 'Nenhum perfil encontrado' : 'Nenhum perfil disponível'}
            description={
              search
                ? 'Não há resultados para essa busca nesta página. Tente outro termo.'
                : 'Ainda não há perfis disponíveis no momento. Volte em breve.'
            }
          />
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-virla-roxo/30
                         text-sm font-semibold text-virla-roxo hover:bg-virla-roxo/10
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft sx={{ fontSize: 20 }} />
              Anterior
            </button>
            <span className="text-sm text-virla-texto/60 font-medium px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-virla-roxo/30
                         text-sm font-semibold text-virla-roxo hover:bg-virla-roxo/10
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Próxima
              <ChevronRight sx={{ fontSize: 20 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
