import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Add from '@mui/icons-material/Add'
import Inbox from '@mui/icons-material/InboxOutlined'
import Chat from '@mui/icons-material/Chat'
import Edit from '@mui/icons-material/Edit'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Cancel from '@mui/icons-material/Cancel'
import Assignment from '@mui/icons-material/Assignment'
import api from '../../services/api'
import { PageLoader } from '../../components/Spinner'
import { Button, Alert, Field, DatePickerField, ConfirmDialog } from '../../components/ui'
import AnimatedTabs from '../../components/ui/AnimatedTabs'
import RequestCard from '../../components/requests/RequestCard'
import { STATES } from '../../constants/states'
import { PAYMENT_RECURRENCES, TURNOS, FREQUENCIAS } from '../../constants/solicitacaoOptions'
import { maskCurrencyInput, parseCurrencyInput } from '../../utils/formatters'
import ServiceReportReviewModal from '../../components/ServiceReportReviewModal'

// ── Constantes de apresentação ─────────────────────────────────────────────
const URGENCIA_OPTIONS = ['BAIXA', 'MEDIA', 'ALTA']
const URGENCIA_LABEL = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' }
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
    <section className="vs-form" aria-labelledby="vs-form-title">
      <header className="vs-form-head">
        <h2 id="vs-form-title">{isEditing ? 'Editar solicitação' : 'Nova solicitação'}</h2>
        <p>Quanto mais claro o pedido, melhor o match com os cuidadores.</p>
      </header>

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
          <p className="block text-xs font-semibold text-virla-muted uppercase tracking-wide" id="vs-tipo-label">
            Tipo de cuidado (selecione todos que se aplicam)
          </p>
          <div className="vs-chips" role="group" aria-labelledby="vs-tipo-label">
            {TIPO_CUIDADO_OPTIONS.map((tag) => {
              const ativo = form.tipoCuidado.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTipo(tag)}
                  aria-pressed={ativo}
                  className={`vs-chip${ativo ? ' is-on' : ''}`}
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
    </section>
  )
}

// ── Card de cada solicitação ───────────────────────────────────────────────
function SolicitacaoCard({ solicitacao, onEditar, onCancelar, onReviewReport, onConversar, canceling }) {
  const local = [solicitacao.cidade, solicitacao.estado].filter(Boolean).join(' - ')
  const podeEditar     = ['ABERTA', 'VISUALIZADA'].includes(solicitacao.status)
  const podeCancelar   = !['CANCELADA', 'CONCLUIDA'].includes(solicitacao.status)
  const emAndamento    = solicitacao.status === 'EM_ANDAMENTO'
  const temFluxoRelatorio = ['EM_ANDAMENTO', 'CONCLUIDA'].includes(solicitacao.status)
  const interessados = solicitacao._count?.interessados ?? 0

  return (
    <RequestCard
      solicitacao={solicitacao}
      place={local}
      highlight={emAndamento}
      extraMeta={interessados > 0 && (
        <span className="vs-foot-strong">
          {interessados} cuidador{interessados !== 1 ? 'es' : ''} interessado{interessados !== 1 ? 's' : ''}
        </span>
      )}
      actions={(
        <>
          {temFluxoRelatorio && (
            <Button size="sm" icon={Assignment} onClick={() => onReviewReport(solicitacao)}>
              {emAndamento ? 'Revisar relatório' : 'Relatório e pagamento'}
            </Button>
          )}
          {emAndamento && (
            <Button size="sm" variant="secondary" icon={Chat} onClick={() => onConversar(solicitacao.assignedCaregiverId)}>
              Conversar com o cuidador
            </Button>
          )}
          {podeEditar && (
            <Button size="sm" variant="secondary" icon={Edit} onClick={() => onEditar(solicitacao)}>
              Editar
            </Button>
          )}
          {podeCancelar && (
            <Button size="sm" variant="ghost" icon={Cancel} loading={canceling} onClick={() => onCancelar(solicitacao.id)} className="vs-cancel">
              Cancelar solicitação
            </Button>
          )}
        </>
      )}
    >
      {emAndamento && solicitacao.assignedCaregiverId && (
        <p className="vs-note">Um cuidador assumiu esta solicitação. Converse para combinar os detalhes.</p>
      )}
    </RequestCard>
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
  const openNew = () => { setEditing(null); setShowForm(true) }

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash vs-page">
        <header className="vs-header">
          <div className="vd-greeting">
            <h1>Minhas solicitações</h1>
            <p>Publique o que você precisa e acompanhe cada pedido de cuidado.</p>
          </div>
          {!showForm && (
            <Button icon={Add} onClick={openNew}>Nova solicitação</Button>
          )}
        </header>

        {message.text && (
          <Alert tone={message.type === 'success' ? 'success' : 'error'} className="vs-alert">{message.text}</Alert>
        )}

        {showForm && (
          <SolicitacaoForm
            initial={editing ?? FORM_EMPTY}
            isEditing={!!editing}
            onSave={handleSave}
            onCancel={handleFormCancel}
            saving={saving}
          />
        )}

        <div className="vs-toolbar">
          <AnimatedTabs
            label="Filtrar solicitações"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'ativas', label: 'Ativas', count: ativas.length },
              { value: 'encerradas', label: 'Encerradas', count: encerradas.length },
            ]}
          />
        </div>

        {lista.length === 0 ? (
          <div className="vd-empty vs-empty">
            <Inbox aria-hidden />
            <strong>{tab === 'ativas' ? 'Você não tem solicitações ativas' : 'Nenhuma solicitação encerrada ainda'}</strong>
            <span>
              {tab === 'ativas'
                ? 'Publique sua primeira solicitação para encontrar um cuidador.'
                : 'Quando uma solicitação for concluída ou cancelada, ela aparece aqui.'}
            </span>
            {tab === 'ativas' && !showForm && <Button icon={Add} onClick={openNew}>Publicar solicitação</Button>}
          </div>
        ) : (
          <div className="vs-list">
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
