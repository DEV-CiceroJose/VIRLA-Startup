import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Person from '@mui/icons-material/Person'
import Chat from '@mui/icons-material/Chat'
import api from '../../services/api'
import { calculateAge } from '../../utils/dateUtils'
import { formatHourly } from '../../utils/formatters'
import { PageLoader } from '../../components/Spinner'
import VerifiedSeal from '../../components/VerifiedSeal'

export default function User() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imgErr, setImgErr] = useState(false)

  const meId = localStorage.getItem('meuId')

  useEffect(() => {
    const token = localStorage.getItem('meuToken')
    if (!token || !meId) {
      navigate('/login')
      return undefined
    }
    if (!userId || userId === meId) {
      navigate('/perfil')
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/users/${userId}`)
        const u = res.data.user ?? res.data
        if (!cancelled) {
          setUser(u)
          setImgErr(false)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setUser(null)
          setError('Não foi possível carregar este perfil.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, meId, navigate])

  if (loading) {
    return <PageLoader label="Carregando perfil…" />
  }

  if (error || !user) {
    return (
      <div className="min-h-screen pt-16 bg-virla-neve flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-virla-texto text-center">{error || 'Perfil não encontrado.'}</p>
        <button
          type="button"
          onClick={() => navigate('/feed')}
          className="text-virla-roxo font-semibold underline"
        >
          Voltar ao feed
        </button>
      </div>
    )
  }

  const age = calculateAge(user.birthDate)
  const rateLabel = formatHourly(user.hourlyRate)
  const specialties = Array.isArray(user.specialties) ? user.specialties : []

  return (
    <div
      className="min-h-screen pt-16 bg-virla-neve pb-10"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 40% at 80% 10%, rgba(128,0,128,0.08), transparent)',
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link
          to="/feed"
          className="inline-flex items-center gap-1 text-sm text-virla-texto/60 hover:text-virla-roxo mb-6"
        >
          <ArrowBack sx={{ fontSize: 18 }} />
          Voltar ao feed
        </Link>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-virla-roxo/10 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-virla-roxo/10 flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
              {user.profileImage && !imgErr ? (
                <img
                  src={user.profileImage}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImgErr(true)}
                />
              ) : (
                <Person sx={{ fontSize: 56 }} className="text-virla-roxo/35" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1
                className="text-2xl font-display font-black text-virla-roxo truncate inline-flex items-center gap-1.5 max-w-full"
              >
                <span className="truncate">{user.name}</span>
                <VerifiedSeal user={user} iconSize={22} />
              </h1>
              <p className="text-sm text-virla-texto/55 mt-1">
                {user.role === 'CUIDADOR' ? 'Cuidador profissional' : 'Familiar'}
                {age !== null && ` · ${age} anos`}
              </p>
              {user.city || user.state ? (
                <p className="text-xs text-virla-texto/45 mt-2">
                  {[user.city, user.state].filter(Boolean).join(', ')}
                </p>
              ) : null}
            </div>
          </div>

          {user.bio && (
            <div>
              <p className="text-xs font-semibold text-virla-muted uppercase tracking-wide mb-2">Apresentação</p>
              <p className="text-sm text-virla-texto/80 whitespace-pre-wrap leading-relaxed">{user.bio}</p>
            </div>
          )}

          {user.role === 'CUIDADOR' && (
            <>
              {rateLabel && (
                <p className="text-lg font-black text-virla-roxo">
                  {rateLabel}
                </p>
              )}
              {(user.crm_crf || user.registerNumber) && (
                <p className="text-sm text-virla-texto/70">
                  <span className="font-semibold">CRM/CRF: </span>
                  {user.crm_crf || user.registerNumber}
                </p>
              )}
              {user.approach && (
                <p className="text-sm text-virla-texto/70">
                  <span className="font-semibold">Abordagem: </span>
                  {user.approach}
                </p>
              )}
              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {specialties.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {user.description && (
                <div>
                  <p className="text-xs font-semibold text-virla-muted uppercase tracking-wide mb-2">
                    Sobre o profissional
                  </p>
                  <p className="text-sm text-virla-texto/75 whitespace-pre-wrap leading-relaxed">{user.description}</p>
                </div>
              )}
            </>
          )}

          <div className="pt-2 flex flex-wrap gap-3 justify-center sm:justify-start">
            <Link
              to={`/chat/${user.id}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-virla-roxo text-white text-sm font-semibold hover:bg-virla-roxohighlight shadow-md transition-all"
            >
              <Chat sx={{ fontSize: 18 }} />
              Enviar mensagem
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
