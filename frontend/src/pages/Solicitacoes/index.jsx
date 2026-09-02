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
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import Schedule from '@mui/icons-material/Schedule'
import Repeat from '@mui/icons-material/Repeat'
import Payments from '@mui/icons-material/Payments'
import Assignment from '@mui/icons-material/Assignment'
import api from '../../services/api'
import { PageLoader } from '../../components/Spinner'
import { Button, Card, Alert, Badge, EmptyState, Field, DatePickerField, ConfirmDialog } from '../../components/ui'
import { STATES } from '../../constants/states'
import { PAYMENT_RECURRENCES, TURNOS, FREQUENCIAS, turnoLabel, frequenciaLabel, paymentRecurrenceLabel } from '../../constants/solicitacaoOptions'
import { maskCurrencyInput, parseCurrencyInput, formatHourly, formatDateOnly } from '../../utils/formatters'
import ServiceReportReviewModal from '../../components/ServiceReportReviewModal'

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

const FORM_EMPTY = {
  titulo: '', descricao: '', urgencia: 'BAIXA', tipoCuidado: [],
  cidade: '', estado: '', dataInicio: '', valorHora: '', turno: '', frequencia: '', paymentRecurrence: '',
}

/** Data local de hoje em YYYY-MM-DD (sem deslocamento UTC), comparável com o input date. */
function todayISO() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Normaliza uma solicitação existente para o estado do form (edição). */
function toFormState(initial) {
  return {
    ...FORM_EMPTY,
    ...initial,
    cidade: initial.cidade ?? '',
    estado: initial.estado ?? '',
    dataInicio: initial.dataInicio ? String(initial.dataInicio).slice(0, 10) : '',
    valorHora:
      initial.valorHora != null
        ? maskCurrencyInput(String(Math.round(Number(initial.valorHora) * 100)))
        : '',
    turno: initial.turno ?? '',
    frequencia: initial.frequencia ?? '',
    paymentRecurrence: initial.paymentRecurrence ?? '',
  }
}

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
function SolicitacaoForm({ initial = FORM_EMPTY, isEditing = false, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => toFormState(initial))
  const [erro, setErro] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setValor = (e) => setForm((f) => ({ ...f, valorHora: maskCurrencyInput(e.target.value) }))

  function toggleTipo(tag) {
    setForm((f) => ({
      ...f,
      tipoCuidado: f.tipoCuidado.includes(tag)
        ? f.tipoCuidado.filter((t) => t !== tag)
        : [...f.tipoCuidado, tag],
    }))
  }

  function buildPayload() {
    const parsed = parseCurrencyInput(form.valorHora) // '' ou '45.00'
    return {
      titulo: form.titulo,
      descricao: form.descricao,
      urgencia: form.urgencia,
      tipoCuidado: form.tipoCuidado,
      cidade: form.cidade.trim(),
      estado: form.estado,
      dataInicio: form.dataInicio,
      valorHora: parsed ? Number(parsed) : null,
      turno: form.turno || null,
      frequencia: form.frequencia || null,
      paymentRecurrence: form.paymentRecurrence,
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.cidade.trim() || !form.estado || !form.dataInicio || !form.valorHora || !form.paymentRecurrence) {
      setErro('Preencha cidade, estado, data de início, valor/hora e recorrência do pagamento.')
      return
    }
    if (!isEditing && form.dataInicio < todayISO()) {
      setErro('A data de início não pode estar no passado.')
      return
    }
    setErro('')
    onSave(buildPayload())
  }

  return (
    <Card className="p-6 space-y-4 border border-virla-roxo/20">
      <h2 className="font-display font-bold text-virla-roxo text-lg">
        {isEditing ? 'Editar solicitação' : 'Nova solicitação'}
      </h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Cidade"
            required
            placeholder="Ex: Fortaleza"
            value={form.cidade}
            onChange={set('cidade')}
            maxLength={80}
          />
          <Field label="Estado" required as="select" value={form.estado} onChange={set('estado')}>
            <option value="">Selecione…</option>
            {STATES.map((uf) => (
              <option key={uf.value} value={uf.value}>{uf.label}</option>
            ))}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePickerField
            label="Data de início"
            required
            min={todayISO()}
            value={form.dataInicio}
            onChange={set('dataInicio')}
          />
          <Field
            label="Valor/hora do contrato"
            required
            placeholder="R$ 0,00"
            inputMode="numeric"
            value={form.valorHora}
            onChange={setValor}
          />
        </div>

        <Field label="Recorrência do pagamento" required as="select" value={form.paymentRecurrence} onChange={set('paymentRecurrence')}>
          <option value="">Selecione…</option>
          {PAYMENT_RECURRENCES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Turno (opcional)" as="select" value={form.turno} onChange={set('turno')}>
            <option value="">Indiferente</option>
            {TURNOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Field>
          <Field label="Frequência (opcional)" as="select" value={form.frequencia} onChange={set('frequencia')}>
            <option value="">Indiferente</option>
            {FREQUENCIAS.map((fr) => (
              <option key={fr.value} value={fr.value}>{fr.label}</option>
            ))}
          </Field>
        </div>

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

        {erro && <Alert tone="error">{erro}</Alert>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} icon={CheckCircle}>
            {isEditing ? 'Salvar alterações' : 'Publicar solicitação'}
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
function SolicitacaoCard({ solicitacao, onEditar, onCancelar, onReviewReport, onConversar, canceling }) {
  const local = [solicitacao.cidade, solicitacao.estado].filter(Boolean).join(' - ')
  const podeEditar     = ['ABERTA', 'VISUALIZADA'].includes(solicitacao.status)
  const podeCancelar   = !['CANCELADA', 'CONCLUIDA'].includes(solicitacao.status)
  const emAndamento    = solicitacao.status === 'EM_ANDAMENTO'
  const temFluxoRelatorio = ['EM_ANDAMENTO', 'CONCLUIDA'].includes(solicitacao.status)

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
        {solicitacao.dataInicio && (
          <span className="flex items-center gap-1">
            <CalendarMonth sx={{ fontSize: 14 }} /> Início {formatDateOnly(solicitacao.dataInicio)}
          </span>
        )}
        {solicitacao.turno && (
          <span className="flex items-center gap-1">
            <Schedule sx={{ fontSize: 14 }} /> {turnoLabel(solicitacao.turno)}
          </span>
        )}
        {solicitacao.frequencia && (
          <span className="flex items-center gap-1">
            <Repeat sx={{ fontSize: 14 }} /> {frequenciaLabel(solicitacao.frequencia)}
          </span>
        )}
        {solicitacao.valorHora != null && (
          <span className="flex items-center gap-1 text-virla-roxo font-semibold">
            <Payments sx={{ fontSize: 14 }} /> {formatHourly(solicitacao.valorHora)}
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
          </>
        )}
        {solicitacao.paymentRecurrence && (
          <span className="flex items-center gap-1 font-semibold text-virla-roxo">
            <Payments sx={{ fontSize: 14 }} /> Pagamento {paymentRecurrenceLabel(solicitacao.paymentRecurrence).toLowerCase()}
          </span>
        )}
        {temFluxoRelatorio && (
          <Button size="sm" icon={Assignment} onClick={() => onReviewReport(solicitacao)}>
            {emAndamento ? 'Revisar relatório' : 'Relatório e pagamento'}
          </Button>
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
  const [confirmId, setConfirmId]     = useState(null)       // id aguardando confirmação
  const [reviewing, setReviewing]     = useState(null)

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
    if (!meuId) { navigate('/login'); return }
    load()
  }, [meuId, navigate, load])

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
            isEditing={!!editing}
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
                onReviewReport={setReviewing}
                onConversar={handleConversar}
                canceling={cancelingId === s.id}
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
      {reviewing && (
        <ServiceReportReviewModal
          solicitacao={reviewing}
          onClose={() => setReviewing(null)}
          onUpdated={async () => {
            setMessage({ type: 'success', text: 'Relatório assinado. O pagamento seguirá a recorrência escolhida no contrato.' })
            await load()
          }}
        />
      )}
    </div>
  )
}
