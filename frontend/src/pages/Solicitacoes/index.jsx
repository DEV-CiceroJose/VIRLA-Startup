import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Add from '@mui/icons-material/Add'
import Inbox from '@mui/icons-material/Inbox'
import LocationOn from '@mui/icons-material/LocationOn'
import PriorityHigh from '@mui/icons-material/PriorityHigh'
import Chat from '@mui/icons-material/Chat'
import Edit from '@mui/icons-material/Edit'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Cancel from '@mui/icons-material/Cancel'
import api from '../../services/api'
import { PageLoader } from '../../components/Spinner'
import { Button, Card, Alert, Badge, EmptyState, Field, ConfirmDialog } from '../../components/ui'

// ── Constantes de apresentação ─────────────────────────────────────────────
const URGENCIA_OPTIONS = ['BAIXA', 'MEDIA', 'ALTA']
const URGENCIA_LABEL = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' }
const URGENCIA_TONE  = { BAIXA: 'gray',  MEDIA: 'amber', ALTA: 'red'  }

const STATUS_LABEL = {
  ABERTA:       'Aberta',
  VISUALIZADA:  'Visualizada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA:    'Concluída',
  CANCELADA:    'Cancelada',
}
const STATUS_TONE = {
  ABERTA:       'blue',
  VISUALIZADA:  'violet',
  EM_ANDAMENTO: 'amber',
  CONCLUIDA:    'green',
  CANCELADA:    'red',
}

const TIPO_CUIDADO_OPTIONS = [
  'Alzheimer', 'Parkinson', 'Pós-operatório', 'Mobilidade reduzida',
  'Diabetes', 'Hipertensão', 'Cuidados paliativos', 'Reabilitação',
  'Acompanhamento diurno', 'Pernoite',
]

const FORM_EMPTY = { titulo: '', descricao: '', urgencia: 'BAIXA', tipoCuidado: [] }

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Skeleton de carregamento ───────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-4 animate-pulse">
      <div className="h-9 bg-virla-roxo/15 rounded w-64" />
      <div className="h-4 bg-virla-roxo/10 rounded w-80" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-36 bg-virla-roxo/10 rounded-2xl" />
      ))}
    </div>
  )
}

// ── Formulário de criação / edição ─────────────────────────────────────────
function SolicitacaoForm({ initial = FORM_EMPTY, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function toggleTipo(tag) {
    setForm((f) => ({
      ...f,
      tipoCuidado: f.tipoCuidado.includes(tag)
        ? f.tipoCuidado.filter((t) => t !== tag)
        : [...f.tipoCuidado, tag],
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <Card className="p-6 space-y-4 border border-virla-roxo/20">
      <h2 className="font-display font-bold text-virla-roxo text-lg">
        {initial.titulo ? 'Editar solicitação' : 'Nova solicitação'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Título"
          required
          placeholder="Ex: Cuidado para idosa com Alzheimer"
          value={form.titulo}
          onChange={set('titulo')}
          maxLength={120}
        />

        <Field
          label="Descrição"
          required
          as="textarea"
          rows={4}
          placeholder="Descreva as necessidades, rotina, horários e qualquer detalhe relevante para o cuidador..."
          value={form.descricao}
          onChange={set('descricao')}
          maxLength={1200}
        />

        <Field label="Urgência" as="select" value={form.urgencia} onChange={set('urgencia')}>
          {URGENCIA_OPTIONS.map((u) => (
            <option key={u} value={u}>{URGENCIA_LABEL[u]}</option>
          ))}
        </Field>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-virla-muted uppercase tracking-wide">
            Tipo de cuidado (selecione todos que se aplicam)
          </label>
          <div className="flex flex-wrap gap-2 mt-1">
            {TIPO_CUIDADO_OPTIONS.map((tag) => {
              const ativo = form.tipoCuidado.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTipo(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    ativo
                      ? 'bg-virla-roxo text-white border-virla-roxo'
                      : 'bg-white text-virla-muted border-virla-roxo/30 hover:border-virla-roxo/60'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} icon={CheckCircle}>
            {initial.titulo ? 'Salvar alterações' : 'Publicar solicitação'}
          </Button>
          <Button type="button" variant="secondary" icon={Cancel} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}

// ── Card de cada solicitação ───────────────────────────────────────────────
function SolicitacaoCard({ solicitacao, onEditar, onCancelar, onConcluir, onConversar, canceling, concluding }) {
  const local = [solicitacao.cidade, solicitacao.estado].filter(Boolean).join(' - ')
  const podeEditar     = ['ABERTA', 'VISUALIZADA'].includes(solicitacao.status)
  const podeCancelar   = !['CANCELADA', 'CONCLUIDA'].includes(solicitacao.status)
  const emAndamento    = solicitacao.status === 'EM_ANDAMENTO'

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
            <Badge key={tag} tone="roxo">{tag}</Badge>
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
        {solicitacao._count?.interessados > 0 && (
          <span className="flex items-center gap-1 text-virla-roxo font-semibold">
            <Chat sx={{ fontSize: 14 }} />
            {solicitacao._count.interessados} cuidador{solicitacao._count.interessados !== 1 ? 'es' : ''} interessado{solicitacao._count.interessados !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {emAndamento && solicitacao.assignedCaregiverId && (
        <p className="text-xs text-virla-texto/70 pt-1 border-t border-virla-roxo/10">
          Um cuidador assumiu esta solicitação. Converse para combinar os detalhes.
        </p>
      )}

      <div className="pt-2 border-t border-virla-roxo/10 flex flex-wrap gap-2">
        {podeEditar && (
          <Button size="sm" variant="secondary" icon={Edit} onClick={() => onEditar(solicitacao)}>
            Editar
          </Button>
        )}
        {emAndamento && (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={Chat}
              onClick={() => onConversar(solicitacao.assignedCaregiverId)}
            >
              Conversar com o cuidador
            </Button>
            <Button size="sm" icon={CheckCircle} loading={concluding} onClick={() => onConcluir(solicitacao.id)}>
              Marcar como concluída
            </Button>
          </>
        )}
        {podeCancelar && (
          <Button
            size="sm"
            variant="danger"
            icon={Cancel}
            loading={canceling}
            onClick={() => onCancelar(solicitacao.id)}
          >
            Cancelar solicitação
          </Button>
        )}
      </div>
    </Card>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function Solicitacoes() {
  const navigate = useNavigate()
  const [loading, setLoading]         = useState(true)
  const [solicitacoes, setSolic]      = useState([])
  const [tab, setTab]                 = useState('ativas')   // 'ativas' | 'encerradas'
  const [message, setMessage]         = useState({ type: '', text: '' })
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)       // objeto sendo editado
  const [saving, setSaving]           = useState(false)
  const [cancelingId, setCancelingId] = useState(null)
  const [concludingId, setConcludingId] = useState(null)
  const [confirmId, setConfirmId]     = useState(null)       // id aguardando confirmação

  const token = localStorage.getItem('meuToken')
  const meuId = localStorage.getItem('meuId')

  // ── Carregamento ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await api.get('/solicitacoes/minhas')
      setSolic(res.data.solicitacoes ?? [])
    } catch (err) {
      const msg = err?.response?.data?.msg || 'Erro ao carregar solicitações.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token || !meuId) { navigate('/login'); return }
    load()
  }, [token, meuId, navigate, load])

  // ── Separar listas por status ─────────────────────────────────────────
  const { ativas, encerradas } = useMemo(() => {
    const ativas = []
    const encerradas = []
    for (const s of solicitacoes) {
      if (['CANCELADA', 'CONCLUIDA'].includes(s.status)) encerradas.push(s)
      else ativas.push(s)
    }
    return { ativas, encerradas }
  }, [solicitacoes])

  // ── Criar / Editar ────────────────────────────────────────────────────
  async function handleSave(form) {
    setMessage({ type: '', text: '' })
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/solicitacoes/${editing.id}`, form)
        setMessage({ type: 'success', text: 'Solicitação atualizada com sucesso!' })
      } else {
        await api.post('/solicitacoes', form)
        setMessage({ type: 'success', text: 'Solicitação publicada! Cuidadores já podem visualizá-la.' })
      }
      setShowForm(false)
      setEditing(null)
      await load()
    } catch (err) {
      const msg = err?.response?.data?.msg || 'Erro ao salvar solicitação.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
    }
  }

  function handleEditar(solicitacao) {
    setEditing(solicitacao)
    setShowForm(true)
    setMessage({ type: '', text: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelarClick(id) {
    setConfirmId(id)
  }

  async function handleCancelarConfirm() {
    const id = confirmId
    setConfirmId(null)
    setMessage({ type: '', text: '' })
    setCancelingId(id)
    try {
      await api.patch(`/solicitacoes/${id}/cancelar`)
      setMessage({ type: 'success', text: 'Solicitação cancelada.' })
      await load()
    } catch (err) {
      const msg = err?.response?.data?.msg || 'Erro ao cancelar solicitação.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setCancelingId(null)
    }
  }

  async function handleConcluir(id) {
    setMessage({ type: '', text: '' })
    setConcludingId(id)
    try {
      await api.patch(`/solicitacoes/${id}/concluir`)
      setMessage({ type: 'success', text: 'Solicitação marcada como concluída. Esperamos que tenha sido um ótimo cuidado!' })
      await load()
    } catch (err) {
      const msg = err?.response?.data?.msg || 'Erro ao concluir solicitação.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setConcludingId(null)
    }
  }

  function handleConversar(caregiverId) {
    if (caregiverId) navigate(`/chat/${caregiverId}`)
  }

  function handleFormCancel() {
    setShowForm(false)
    setEditing(null)
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLoader label="Carregando suas solicitações…">
        <Skeleton />
      </PageLoader>
    )
  }

  const lista = tab === 'ativas' ? ativas : encerradas

  return (
    <div
      className="min-h-screen pt-16 bg-virla-neve"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 70% 50% at 70% 0%, rgba(128,0,128,0.07), transparent)',
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-3xl font-display font-black text-virla-roxo">Minhas Solicitações</h1>
            <p className="text-virla-muted text-sm mt-1">
              Gerencie os pedidos de cuidado que você publicou
            </p>
          </div>
          {!showForm && (
            <Button icon={Add} onClick={() => { setEditing(null); setShowForm(true) }}>
              Nova
            </Button>
          )}
        </div>

        {/* Alerta de feedback */}
        {message.text && (
          <Alert tone={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
        )}

        {/* Formulário inline */}
        {showForm && (
          <SolicitacaoForm
            initial={editing ?? FORM_EMPTY}
            onSave={handleSave}
            onCancel={handleFormCancel}
            saving={saving}
          />
        )}

        {/* Abas */}
        <div className="flex gap-1 bg-virla-roxo/8 rounded-xl p-1 w-fit">
          {[
            { key: 'ativas',     label: 'Ativas',     count: ativas.length     },
            { key: 'encerradas', label: 'Encerradas', count: encerradas.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-white text-virla-roxo shadow-sm'
                  : 'text-virla-muted hover:text-virla-roxo'
              }`}
            >
              {label} {count > 0 && `(${count})`}
            </button>
          ))}
        </div>

        {/* Lista */}
        {lista.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              tab === 'ativas'
                ? 'Você não tem solicitações ativas'
                : 'Nenhuma solicitação encerrada ainda'
            }
            description={
              tab === 'ativas'
                ? 'Clique em "Nova" para publicar sua primeira solicitação e encontrar um cuidador.'
                : 'Quando uma solicitação for concluída ou cancelada, ela aparecerá aqui.'
            }
            action={
              tab === 'ativas' && !showForm
                ? <Button icon={Add} onClick={() => { setEditing(null); setShowForm(true) }}>Publicar solicitação</Button>
                : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {lista.map((s) => (
              <SolicitacaoCard
                key={s.id}
                solicitacao={s}
                onEditar={handleEditar}
                onCancelar={handleCancelarClick}
                onConcluir={handleConcluir}
                onConversar={handleConversar}
                canceling={cancelingId === s.id}
                concluding={concludingId === s.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Diálogo de confirmação de cancelamento */}
      <ConfirmDialog
        open={!!confirmId}
        title="Cancelar solicitação?"
        description="Esta ação não pode ser desfeita. A solicitação ficará visível como Cancelada no histórico."
        confirmLabel="Sim, cancelar"
        cancelLabel="Voltar"
        onConfirm={handleCancelarConfirm}
        onCancel={() => setConfirmId(null)}
        tone="danger"
      />
    </div>
  )
}
