import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowBack,
  ChatBubbleOutlineOutlined,
  CheckCircle,
  ChevronRight,
  PlaceOutlined,
  PostAddOutlined,
} from '@mui/icons-material'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { calculateAge } from '../../utils/dateUtils'
import { formatHourly } from '../../utils/formatters'
import { PageLoader } from '../../components/Spinner'
import { specialtyLabel } from '../../constants/specialties'
import { frequenciaLabel, turnoLabel } from '../../constants/solicitacaoOptions'
import '../../design-system/profile.css'

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
}

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : [])

export default function User() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { profile: me } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imgErr, setImgErr] = useState(false)

  const meId = localStorage.getItem('meuId')

  useEffect(() => {
    if (!meId) {
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

  const viewerIsFamily = me?.role === 'FAMILIAR'
  const backTo = viewerIsFamily ? { to: '/feed', label: 'Buscar cuidadores' } : { to: '/home', label: 'Início' }

  if (error || !user) {
    return (
      <div className="comfort-page min-h-screen pt-16">
        <div className="vd-dash vp-page">
          <div className="vd-empty vp-missing" role="alert">
            <strong>{error || 'Perfil não encontrado.'}</strong>
            <span>Confira o link ou volte e escolha outro perfil.</span>
            <Link to={backTo.to} className="vp-missing-link">Voltar para {backTo.label.toLowerCase()}</Link>
          </div>
        </div>
      </div>
    )
  }

  const isCaregiver = user.role === 'CUIDADOR'
  const firstName = String(user.name ?? '').trim().split(/\s+/)[0] || 'este perfil'
  const age = calculateAge(user.birthDate)
  const rateLabel = isCaregiver ? formatHourly(user.hourlyRate) : null
  const place = [user.city, user.state].filter(Boolean).join(', ')
  const specialties = list(user.specialties)
  const shifts = list(user.availableShifts)
  const frequencies = list(user.serviceFrequencies)
  const about = user.description || user.bio
  const extraBio = user.description && user.bio && user.bio !== user.description ? user.bio : null
  const hasRegister = Boolean(user.council && String(user.council).trim())
  const roleLine = [isCaregiver ? 'Profissional de cuidado' : 'Familiar', age !== null ? `${age} anos` : null]
    .filter(Boolean)
    .join(', ')
  const showPhoto = user.profileImage && !imgErr

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash vp-page">
        <nav className="vp-crumbs" aria-label="Você está em">
          <Link to={backTo.to}>
            <ArrowBack aria-hidden className="vp-crumbs-back" />
            {backTo.label}
          </Link>
          <ChevronRight aria-hidden className="vp-crumbs-sep" />
          <span aria-current="page">{user.name}</span>
        </nav>

        <div className="vp-layout">
          <aside className="vp-identity" aria-labelledby="vp-name">
            <div className={`vp-portrait${showPhoto ? '' : ' is-initials'}`}>
              {showPhoto ? (
                <img src={user.profileImage} alt={`Foto de ${user.name}`} onError={() => setImgErr(true)} />
              ) : (
                <span aria-hidden>{initials(user.name)}</span>
              )}
            </div>

            <div className="vp-card">
              <h1 id="vp-name" className="vp-name">{user.name}</h1>
              <p className="vp-role">{roleLine}</p>

              {(rateLabel || place) && (
                <ul className="vp-chips" aria-label="Resumo">
                  {rateLabel && <li className="vp-chip vp-chip-strong">{rateLabel}</li>}
                  {place && (
                    <li className="vp-chip">
                      <PlaceOutlined aria-hidden />
                      {place}
                    </li>
                  )}
                </ul>
              )}

              {isCaregiver && (
                <ul className="vp-checks">
                  {hasRegister ? (
                    <li>
                      <span>
                        Registro profissional
                        <small>{user.council} {user.registerNumber}</small>
                      </span>
                      <CheckCircle aria-label="Informado" className="vp-check-ok" />
                    </li>
                  ) : (
                    <li className="is-missing">
                      <span>
                        Registro profissional
                        <small>Ainda não informado</small>
                      </span>
                    </li>
                  )}
                </ul>
              )}

              <Link to={`/chat/${user.id}`} className="vp-cta">
                <ChatBubbleOutlineOutlined aria-hidden />
                Conversar com {firstName}
              </Link>

              {isCaregiver && viewerIsFamily && (
                <div className="vp-alt">
                  <p>
                    <strong>Prefere descrever o que precisa?</strong>
                    <span>Publique uma solicitação e receba o contato de cuidadores.</span>
                  </p>
                  <Link to="/solicitacoes" className="vp-alt-btn">
                    <PostAddOutlined aria-hidden />
                    Publicar solicitação
                  </Link>
                </div>
              )}
            </div>
          </aside>

          <div className="vp-sections">
            <section className="vd-panel vp-section" aria-labelledby="vp-about">
              <h2 id="vp-about">Sobre {firstName}</h2>
              {about ? (
                <>
                  <p className="vp-prose">{about}</p>
                  {extraBio && <p className="vp-prose">{extraBio}</p>}
                </>
              ) : (
                <p className="vp-muted">{firstName} ainda não escreveu uma apresentação.</p>
              )}
            </section>

            {isCaregiver && specialties.length > 0 && (
              <section className="vd-panel vp-section" aria-labelledby="vp-skills">
                <h2 id="vp-skills">Especialidades</h2>
                <ul className="vp-tags">
                  {specialties.map((tag, i) => <li key={`${tag}-${i}`}>{specialtyLabel(tag)}</li>)}
                </ul>
              </section>
            )}

            {isCaregiver && (shifts.length > 0 || frequencies.length > 0) && (
              <section className="vd-panel vp-section" aria-labelledby="vp-availability">
                <h2 id="vp-availability">Disponibilidade</h2>
                <dl className="vp-availability">
                  {shifts.length > 0 && (
                    <div>
                      <dt>Turnos</dt>
                      <dd><ul className="vp-tags is-quiet">{shifts.map((s) => <li key={s}>{turnoLabel(s)}</li>)}</ul></dd>
                    </div>
                  )}
                  {frequencies.length > 0 && (
                    <div>
                      <dt>Frequência</dt>
                      <dd><ul className="vp-tags is-quiet">{frequencies.map((f) => <li key={f}>{frequenciaLabel(f)}</li>)}</ul></dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {isCaregiver && user.approach && (
              <section className="vd-panel vp-section" aria-labelledby="vp-approach">
                <h2 id="vp-approach">Como {firstName} trabalha</h2>
                <p className="vp-prose">{user.approach}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
