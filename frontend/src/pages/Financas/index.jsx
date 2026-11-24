import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AccountBalanceWalletOutlined,
  ArrowForward,
  EventAvailableOutlined,
  InfoOutlined,
  LocalOfferOutlined,
  ReportProblemOutlined,
  ScheduleOutlined,
  SouthWest,
  UndoOutlined,
} from '@mui/icons-material'
import api from '../../services/api'
import '../../design-system/finance.css'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (cents) => brl.format((cents || 0) / 100)

// Cada status do relatório vira um rótulo curto, uma explicação e um "tom" visual.
// tone: ok = dinheiro recebido · wait = vai entrar · risk = não vai entrar (ou está travado)
const STATUS = {
  PAID: { label: 'Recebido', hint: 'Pagamento confirmado pela família', tone: 'ok', Icon: SouthWest },
  SIGNED: { label: 'Aguardando pagamento', hint: 'Relatório assinado, falta a família pagar', tone: 'wait', Icon: ScheduleOutlined },
  PAYMENT_PENDING: { label: 'Em processamento', hint: 'O pagamento está sendo processado', tone: 'wait', Icon: ScheduleOutlined },
  PENDING_SIGNATURE: { label: 'Aguardando assinatura', hint: 'A família ainda precisa assinar o relatório', tone: 'wait', Icon: ScheduleOutlined },
  REFUND_PENDING: { label: 'Reembolso em andamento', hint: 'O valor está sendo devolvido à família', tone: 'risk', Icon: UndoOutlined },
  REFUNDED: { label: 'Reembolsado', hint: 'O valor foi devolvido à família', tone: 'risk', Icon: UndoOutlined },
  DISPUTED: { label: 'Em análise', hint: 'A equipe VIRLA está analisando este atendimento', tone: 'risk', Icon: ReportProblemOutlined },
}
const statusOf = (status) => STATUS[status] ?? { label: status, hint: '', tone: 'wait', Icon: ScheduleOutlined }

const RECEIVABLE = new Set(['SIGNED', 'PAYMENT_PENDING'])

const TABS = [
  { id: 'all', label: 'Todos', match: () => true },
  { id: 'paid', label: 'Recebidos', match: (e) => e.status === 'PAID' },
  { id: 'receivable', label: 'A receber', match: (e) => RECEIVABLE.has(e.status) },
]

const PERIODS = [
  { id: 'all', label: 'Todo o período' },
  { id: '30', label: 'Últimos 30 dias', days: 30 },
  { id: '90', label: 'Últimos 3 meses', days: 90 },
  { id: 'year', label: 'Este ano' },
]

const toDate = (serviceDate) => (serviceDate ? new Date(`${serviceDate}T12:00:00`) : null)

function inPeriod(entry, periodId, now) {
  if (periodId === 'all') return true
  const date = toDate(entry.serviceDate)
  if (!date) return false
  if (periodId === 'year') return date.getFullYear() === now.getFullYear()
  const { days } = PERIODS.find((p) => p.id === periodId)
  return now - date <= days * 86_400_000
}

const monthKey = (entry) => (entry.serviceDate ? entry.serviceDate.slice(0, 7) : 'sem-data')
const monthLabel = (key) => {
  if (key === 'sem-data') return 'Sem data informada'
  const text = new Date(`${key}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}
const dayLabel = (entry, options) => {
  const date = toDate(entry.serviceDate)
  return date ? date.toLocaleDateString('pt-BR', options) : 'Data não informada'
}
// "Seg, 23 nov" — curto e sem os pontos de abreviação do Intl.
const shortDay = (entry) => {
  const date = toDate(entry.serviceDate)
  if (!date) return 'Sem data'
  const part = (opts) => date.toLocaleDateString('pt-BR', opts).replace('.', '')
  const weekday = part({ weekday: 'short' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.getDate()} ${part({ month: 'short' })}`
}

export default function Financas() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')
  const [period, setPeriod] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    let active = true
    api.get('/payments/caregiver/summary')
      .then(({ data }) => { if (active) setSummary(data) })
      .catch(() => { if (active) setError('Não foi possível carregar seus dados financeiros. Atualize a página para tentar de novo.') })
    return () => { active = false }
  }, [])

  const entries = useMemo(() => summary?.entries ?? [], [summary])

  const statusOptions = useMemo(
    () => [...new Set(entries.map((e) => e.status))].sort((a, b) => statusOf(a).label.localeCompare(statusOf(b).label)),
    [entries],
  )

  const months = useMemo(() => {
    const now = new Date()
    const { match } = TABS.find((t) => t.id === tab)
    const visible = entries
      .filter((e) => match(e) && inPeriod(e, period, now) && (status === 'all' || e.status === status))
      .sort((a, b) => (b.serviceDate ?? '').localeCompare(a.serviceDate ?? ''))

    const groups = new Map()
    for (const entry of visible) {
      const key = monthKey(entry)
      if (!groups.has(key)) groups.set(key, { key, entries: [], paid: 0, receivable: 0 })
      const group = groups.get(key)
      group.entries.push(entry)
      if (entry.status === 'PAID') group.paid += entry.amountCents
      else if (RECEIVABLE.has(entry.status)) group.receivable += entry.amountCents
    }
    return [...groups.values()]
  }, [entries, tab, period, status])

  const filtersActive = period !== 'all' || status !== 'all'
  const clearFilters = () => { setPeriod('all'); setStatus('all') }

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash vf-page">
        <header className="vd-greeting">
          <h1>Finanças</h1>
          <p>O que você já recebeu e o que ainda vai entrar, atendimento por atendimento.</p>
        </header>

        {error && <div role="alert" className="vf-alert">{error}</div>}

        {!summary && !error && (
          <p role="status" className="vf-loading">Carregando seu resumo financeiro…</p>
        )}

        {summary && (
          <>
            <div className="vf-summary">
              <section className="vd-card vd-card-dark vf-summary-main" aria-labelledby="vf-received">
                <span className="vf-summary-label" id="vf-received">Recebido</span>
                <strong className="vf-figure vf-figure-lg">{money(summary.receivedCents)}</strong>
                <p>
                  {summary.completedServices}{' '}
                  {summary.completedServices === 1 ? 'atendimento pago' : 'atendimentos pagos'}
                </p>
              </section>

              <section className="vd-card" aria-labelledby="vf-receivable">
                <span className="vd-card-icon"><EventAvailableOutlined aria-hidden /></span>
                <span className="vf-summary-label" id="vf-receivable">A receber</span>
                <strong className="vf-figure">{money(summary.receivableCents)}</strong>
                <p>
                  {summary.pendingServices}{' '}
                  {summary.pendingServices === 1 ? 'relatório assinado aguardando pagamento' : 'relatórios assinados aguardando pagamento'}
                </p>
              </section>

              <section className="vd-card" aria-labelledby="vf-rate">
                <span className="vd-card-icon alt"><LocalOfferOutlined aria-hidden /></span>
                <span className="vf-summary-label" id="vf-rate">Seu valor por hora</span>
                <strong className="vf-figure">{summary.hourlyRate ? brl.format(summary.hourlyRate) : '—'}</strong>
                <p>
                  {summary.hourlyRate
                    ? 'Usado como referência nos novos atendimentos.'
                    : <>Defina seu valor no <Link to="/perfil" className="vf-inline-link">perfil</Link>.</>}
                </p>
              </section>
            </div>

            <p className="vf-note">
              <InfoOutlined aria-hidden fontSize="small" />
              <span>Os valores vêm dos relatórios de serviço. “A receber” inclui só atendimentos já feitos e com relatório assinado.</span>
            </p>

            <section className="vd-panel vf-history" aria-labelledby="vf-history-title">
              <div className="vf-history-head">
                <h2 id="vf-history-title">Histórico</h2>
                <div className="vf-tabs" role="tablist" aria-label="Filtrar por situação">
                  {TABS.map((t) => {
                    const count = entries.filter(t.match).length
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        className="vf-tab"
                        onClick={() => setTab(t.id)}
                      >
                        {t.label}
                        <span className="vf-tab-count">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {entries.length > 0 && (
                <div className="vf-filters">
                  <label className="vf-select">
                    <span className="sr-only">Período</span>
                    <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                      {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label className="vf-select">
                    <span className="sr-only">Situação</span>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="all">Todas as situações</option>
                      {statusOptions.map((s) => <option key={s} value={s}>{statusOf(s).label}</option>)}
                    </select>
                  </label>
                  {filtersActive && (
                    <button type="button" className="vf-clear" onClick={clearFilters}>Limpar filtros</button>
                  )}
                </div>
              )}

              {entries.length === 0 ? (
                <div className="vd-empty vf-empty">
                  <AccountBalanceWalletOutlined aria-hidden />
                  <strong>Nenhum atendimento com relatório ainda</strong>
                  <span>Quando você registrar o relatório de um atendimento, o valor aparece aqui.</span>
                  <Link to="/solicitacoes-disponiveis" className="vf-empty-link">
                    Ver oportunidades <ArrowForward fontSize="small" aria-hidden />
                  </Link>
                </div>
              ) : months.length === 0 ? (
                <div className="vd-empty vf-empty">
                  <strong>Nenhum atendimento com esses filtros</strong>
                  <span>Mude o período ou a situação para ver outros atendimentos.</span>
                  {filtersActive && <button type="button" onClick={clearFilters}>Limpar filtros</button>}
                </div>
              ) : (
                <>
                  <div className="vf-cols" aria-hidden>
                    <span>Atendimento</span><span>Situação</span><span>Data</span><span>Valor</span>
                  </div>
                  {months.map((group) => (
                    <section key={group.key} className="vf-month" aria-label={monthLabel(group.key)}>
                      <header className="vf-month-head">
                        <h3>{monthLabel(group.key)}</h3>
                        <p>
                          {group.paid > 0 && <span className="vf-month-total">{money(group.paid)} recebidos</span>}
                          {group.receivable > 0 && <span>{money(group.receivable)} a receber</span>}
                        </p>
                      </header>
                      <ul className="vf-rows">
                        {group.entries.map((entry) => {
                          const info = statusOf(entry.status)
                          const { Icon } = info
                          return (
                            <li key={entry.id} className={`vf-row tone-${info.tone} s-${entry.status}`}>
                              <span className="vf-row-icon"><Icon aria-hidden /></span>
                              <span className="vf-row-main">
                                <strong>Atendimento de {dayLabel(entry, { day: 'numeric', month: 'long' })}</strong>
                                <small>{info.hint}</small>
                              </span>
                              <span className="vf-badge">{info.label}</span>
                              <span className="vf-row-date">{shortDay(entry)}</span>
                              <span className="vf-row-amount">
                                {entry.status === 'PAID' && <span aria-hidden>+ </span>}
                                {money(entry.amountCents)}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  ))}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
