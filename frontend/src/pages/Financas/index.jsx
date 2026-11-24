import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountBalanceWallet, ArrowForward, CalendarMonth, Payments } from '@mui/icons-material'
import api from '../../services/api'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)

const statusLabel = {
  PAID: 'Recebido',
  SIGNED: 'Aguardando pagamento',
  PAYMENT_PENDING: 'Pagamento em processamento',
  PENDING_SIGNATURE: 'Aguardando confirmação',
  REFUND_PENDING: 'Reembolso em andamento',
  REFUNDED: 'Reembolsado',
  DISPUTED: 'Em análise',
}

export default function Financas() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/payments/caregiver/summary')
      .then(({ data }) => { if (active) setSummary(data) })
      .catch(() => { if (active) setError('Não foi possível carregar seus dados financeiros agora.') })
    return () => { active = false }
  }, [])

  return (
    <main className="comfort-page comfort-finance">
      <div className="comfort-content">
        <div className="comfort-page-heading">
          <div>
            <span className="comfort-eyebrow">Área do cuidador</span>
            <h1>Suas finanças, com clareza.</h1>
            <p>Acompanhe os valores dos atendimentos registrados na VIRLA.</p>
          </div>
          <div className="comfort-heading-icon"><AccountBalanceWallet aria-hidden /></div>
        </div>

        {error && <div role="alert" className="comfort-alert">{error}</div>}
        {!summary && !error && <p role="status" className="comfort-loading">Carregando resumo financeiro…</p>}

        {summary && (
          <>
            <div className="comfort-finance-cards">
              <section className="comfort-finance-card comfort-finance-card-primary">
                <span className="comfort-finance-icon"><Payments aria-hidden /></span>
                <p>Recebido</p>
                <strong>{money(summary.receivedCents)}</strong>
                <small>{summary.completedServices} {summary.completedServices === 1 ? 'atendimento confirmado' : 'atendimentos confirmados'}</small>
              </section>
              <section className="comfort-finance-card">
                <span className="comfort-finance-icon"><CalendarMonth aria-hidden /></span>
                <p>A receber</p>
                <strong>{money(summary.receivableCents)}</strong>
                <small>{summary.pendingServices} {summary.pendingServices === 1 ? 'relatório assinado' : 'relatórios assinados'} aguardando pagamento</small>
              </section>
              <section className="comfort-finance-card">
                <span className="comfort-finance-icon"><ArrowForward aria-hidden /></span>
                <p>Valor anunciado por hora</p>
                <strong>{summary.hourlyRate ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.hourlyRate) : '—'}</strong>
                <small>Referência para novos atendimentos; o total depende das horas combinadas.</small>
              </section>
            </div>

            <div className="comfort-info-note">Os valores são calculados a partir dos relatórios de serviço. “A receber” inclui apenas atendimentos já realizados e assinados; não é uma promessa de receita futura.</div>

            <section className="comfort-panel comfort-finance-history">
              <div className="comfort-section-heading"><div><span className="comfort-eyebrow">Acompanhamento</span><h2>Histórico de atendimentos</h2></div></div>
              {summary.entries.length === 0 ? (
                <div className="comfort-empty"><AccountBalanceWallet aria-hidden /><h3>Nenhum valor registrado ainda</h3><p>Quando um atendimento tiver relatório, ele aparecerá aqui.</p><Link to="/solicitacoes-disponiveis">Ver oportunidades <ArrowForward fontSize="small" aria-hidden /></Link></div>
              ) : (
                <div className="comfort-finance-list">
                  {summary.entries.map((entry) => (
                    <div className="comfort-finance-row" key={entry.id}>
                      <div><strong>Atendimento em {entry.serviceDate ? new Date(`${entry.serviceDate}T12:00:00`).toLocaleDateString('pt-BR') : 'data não informada'}</strong><span>{statusLabel[entry.status] ?? entry.status}</span></div>
                      <strong>{money(entry.amountCents)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
