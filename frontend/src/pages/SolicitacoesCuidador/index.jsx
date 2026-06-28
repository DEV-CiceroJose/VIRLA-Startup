import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Inbox from '@mui/icons-material/Inbox'
import Visibility from '@mui/icons-material/Visibility'
import LocationOn from '@mui/icons-material/LocationOn'
import PriorityHigh from '@mui/icons-material/PriorityHigh'
import Chat from '@mui/icons-material/Chat'
import Person from '@mui/icons-material/Person'
import AssignmentTurnedIn from '@mui/icons-material/AssignmentTurnedIn'
import api from '../../services/api'
import { PageLoader } from '../../components/Spinner'
import { Button, Card, Alert, Badge, EmptyState } from '../../components/ui'

const URGENCIA_LABEL = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' }
const URGENCIA_TONE = { BAIXA: 'gray', MEDIA: 'amber', ALTA: 'red' }

const STATUS_LABEL = {
  ABERTA: 'Aberta',
  VISUALIZADA: 'Visualizada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}
const STATUS_TONE = {
  ABERTA: 'blue',
  VISUALIZADA: 'violet',
  EM_ANDAMENTO: 'amber',
  CONCLUIDA: 'green',
  CANCELADA: 'red',
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SolicitacaoCard({ solicitacao, mode, onVisualizar, onAssumir, onConversar, busy }) {
  const local = [solicitacao.familiar?.city, solicitacao.familiar?.state].filter(Boolean).join(' - ')
  const showFamiliar = mode === 'visualizada' || mode === 'andamento'

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-virla-texto text-base leading-snug">{solicitacao.titulo}</h3>
        <Badge tone={STATUS_TONE[solicitacao.status] ?? 'gray'}>
          {STATUS_LABEL[solicitacao.status] ?? solicitacao.status}
        </Badge>
      </div>

      <p className="text-sm text-virla-muted whitespace-pre-wrap">{solicitacao.descricao}</p>

      {solicitacao.tipoCuidado?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {solicitacao.tipoCuidado.map((tag) => (
            <Badge key={tag} tone="roxo">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-virla-muted/80 pt-1 flex-wrap">
        <Badge tone={URGENCIA_TONE[solicitacao.urgencia] ?? 'gray'} icon={PriorityHigh}>
          Urgência {URGENCIA_LABEL[solicitacao.urgencia] ?? solicitacao.urgencia}
        </Badge>
        {local && (
          <span className="flex items-center gap-1">
            <LocationOn sx={{ fontSize: 14 }} /> {local}
          </span>
        )}
        <span>Publicada em {formatDate(solicitacao.createdAt)}</span>
      </div>

      {solicitacao.familiar?.name && showFamiliar && (
        <p className="flex items-center gap-1.5 text-xs text-virla-texto/70 pt-1 border-t border-virla-roxo/10">
          <Person sx={{ fontSize: 14 }} className="text-virla-roxo/60" />
          Família: <span className="font-semibold">{solicitacao.familiar.name}</span>
        </p>
      )}

      <div className="pt-2 border-t border-virla-roxo/10 flex flex-wrap gap-2">
        {mode === 'disponivel' && (
          <Button size="sm" icon={Visibility} loading={busy} onClick={() => onVisualizar(solicitacao)}>
            Ver detalhes
          </Button>
        )}
        {mode === 'visualizada' && (
          <>
            <Button size="sm" icon={AssignmentTurnedIn} loading={busy} onClick={() => onAssumir(solicitacao)}>
              Assumir solicitação
            </Button>
            <Button size="sm" variant="secondary" icon={Chat} onClick={() => onConversar(solicitacao.familiarId)}>
              Conversar com a família
            </Button>
          </>
        )}
        {mode === 'andamento' && (
          <Button size="sm" variant="secondary" icon={Chat} onClick={() => onConversar(solicitacao.familiarId)}>
            Conversar com a família
          </Button>
        )}
      </div>
    </Card>
  )
}

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-4 animate-pulse">
      <div className="h-9 bg-virla-roxo/15 rounded w-56" />
      <div className="h-4 bg-virla-roxo/10 rounded w-72" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 bg-virla-roxo/10 rounded-2xl" />
      ))}
    </div>
  )
}

const TABS = [
  { key: 'disponiveis', label: 'Disponíveis' },
  { key: 'visualizadas', label: 'Visualizadas' },
  { key: 'andamento', label: 'Em andamento' },
]

export default function SolicitacoesCuidador() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [solicitacoes, setSolicitacoes] = useState([])
  const [tab, setTab] = useState('disponiveis')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [busyId, setBusyId] = useState(null)

  const token = localStorage.getItem('meuToken')
  const meuId = localStorage.getItem('meuId')

  async function loadSolicitacoes() {
    try {
      const res = await api.get('/solicitacoes/disponiveis')
      setSolicitacoes(res.data.solicitacoes ?? [])
    } catch (err) {
      const msg = err?.response?.data?.msg || 'Erro ao carregar solicitações.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadSolicitacoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const { disponiveis, visualizadas, andamento } = useMemo(() => {
    const disp = []
    const vis = []
    const and = []
    for (const s of solicitacoes) {
      if (s.status === 'EM_ANDAMENTO' && s.assignedCaregiverId === meuId) {
        and.push(s)
      } else if (Array.isArray(s.viewedByIds) && s.viewedByIds.includes(meuId)) {
        vis.push(s)
      } else {
        disp.push(s)
      }
    }
    return { disponiveis: disp, visualizadas: vis, andamento: and }
  }, [solicitacoes, meuId])

  const buckets = { disponiveis, visualizadas, andamento }

  async function handleVisualizar(solicitacao) {
    setMessage({ type: '', text: '' })
    try {
      setBusyId(solicitacao.id)
      await api.put(`/solicitacoes/${solicitacao.id}/visualizar`)
      await loadSolicitacoes()
      setTab('visualizadas')
    } catch {
      setMessage({ type: 'error', text: 'Erro ao abrir solicitação.' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleAssumir(solicitacao) {
    setMessage({ type: '', text: '' })
    try {
      setBusyId(solicitacao.id)
      await api.patch(`/solicitacoes/${solicitacao.id}/assumir`)
      await loadSolicitacoes()
      setTab('andamento')
      setMessage({ type: 'success', text: 'Você assumiu esta solicitação. A família foi notificada.' })
    } catch (err) {
      const msg = err?.response?.data?.msg || 'Erro ao assumir solicitação.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setBusyId(null)
    }
  }

  function handleConversar(familiarId) {
    navigate(`/chat/${familiarId}`)
  }

  if (loading) {
    return (
      <PageLoader label="Carregando solicitações…">
        <Skeleton />
      </PageLoader>
    )
  }

  const lista = buckets[tab]
  const modeForTab = { disponiveis: 'disponivel', visualizadas: 'visualizada', andamento: 'andamento' }

  return (
    <div
      className="min-h-screen pt-16 bg-virla-neve"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 70% 50% at 30% 0%, rgba(128,0,128,0.07), transparent)',
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display font-black text-virla-roxo">Solicitações</h1>
          <p className="text-virla-muted text-sm mt-1">
            Famílias buscando cuidado — navegue pelas solicitações em vez de perfis
          </p>
        </div>

        {message.text && (
          <Alert tone={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
        )}

        <div className="flex gap-1 bg-virla-roxo/8 rounded-xl p-1 w-fit flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key ? 'bg-white text-virla-roxo shadow-sm' : 'text-virla-muted hover:text-virla-roxo'
              }`}
            >
              {t.label} {buckets[t.key].length > 0 && `(${buckets[t.key].length})`}
            </button>
          ))}
        </div>

        {lista.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              tab === 'disponiveis'
                ? 'Nenhuma solicitação disponível'
                : tab === 'visualizadas'
                  ? 'Você ainda não visualizou nenhuma'
                  : 'Nenhuma solicitação em andamento'
            }
            description={
              tab === 'disponiveis'
                ? 'Quando uma família publicar uma solicitação, ela aparecerá aqui.'
                : tab === 'visualizadas'
                  ? 'Abra uma solicitação na aba "Disponíveis" para conhecer os detalhes e decidir se quer assumi-la.'
                  : 'Assuma uma solicitação na aba "Visualizadas" para acompanhá-la aqui.'
            }
          />
        ) : (
          <div className="space-y-4">
            {lista.map((s) => (
              <SolicitacaoCard
                key={s.id}
                solicitacao={s}
                mode={modeForTab[tab]}
                onVisualizar={handleVisualizar}
                onAssumir={handleAssumir}
                onConversar={handleConversar}
                busy={busyId === s.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
