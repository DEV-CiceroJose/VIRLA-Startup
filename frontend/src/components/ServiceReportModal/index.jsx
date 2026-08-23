import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Close from '@mui/icons-material/Close'
import Assignment from '@mui/icons-material/Assignment'
import api from '../../services/api'
import { Alert, Button, Field } from '../ui'
import { calculateChargeTotalCents, formatCentsBRL, reaisToCents } from '../../utils/paymentFees'

function localDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function ServiceReportModal({ solicitacao, onClose, onCreated }) {
  const [form, setForm] = useState({
    serviceDate: localDate(),
    startedAt: '08:00',
    endedAt: '16:00',
    activities: '',
    observations: '',
    incidents: '',
    baseReais: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const baseAmount = useMemo(() => reaisToCents(form.baseReais), [form.baseReais])
  const fees = baseAmount ? calculateChargeTotalCents(baseAmount) : null

  async function handleSubmit(event) {
    event.preventDefault()
    if (!baseAmount) {
      setError('Informe o valor do serviço.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/service-reports', {
        solicitacaoId: solicitacao.id,
        serviceDate: form.serviceDate,
        startedAt: form.startedAt,
        endedAt: form.endedAt,
        activities: form.activities,
        observations: form.observations,
        incidents: form.incidents,
        baseAmount,
      })
      onCreated?.(response.data.report)
      onClose()
    } catch (err) {
      setError(err.response?.data?.msg ?? 'Não foi possível enviar o relatório.')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="report-title" className="text-xl font-display font-black text-virla-roxo">Relatório do dia</h2>
            <p className="text-sm text-virla-muted mt-1">{solicitacao.titulo}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-lg hover:bg-virla-roxo/10"><Close /></button>
        </div>

        <Alert tone="info">
          Depois do envio, o relatório não poderá ser alterado. O familiar deverá revisar e assinar antes de o pagamento ser liberado.
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Data do serviço" required type="date" max={localDate()} value={form.serviceDate} onChange={set('serviceDate')} />
            <Field label="Início" required type="time" value={form.startedAt} onChange={set('startedAt')} />
            <Field label="Término" required type="time" value={form.endedAt} onChange={set('endedAt')} />
          </div>
          <Field label="Atividades realizadas" required as="textarea" rows={5} maxLength={4000} value={form.activities} onChange={set('activities')} placeholder="Descreva alimentação, medicação, higiene, acompanhamento e demais atividades..." />
          <Field label="Observações" as="textarea" rows={3} maxLength={3000} value={form.observations} onChange={set('observations')} placeholder="Como a pessoa assistida passou o dia?" />
          <Field label="Intercorrências" as="textarea" rows={3} maxLength={3000} value={form.incidents} onChange={set('incidents')} placeholder="Registre qualquer ocorrência relevante ou informe que não houve." />
          <Field label="Valor do serviço" required inputMode="decimal" value={form.baseReais} onChange={set('baseReais')} placeholder="Ex.: 150,00" />

          {fees && (
            <div className="rounded-xl border border-virla-roxo/10 bg-virla-roxo/5 p-4 text-sm space-y-1">
              <p className="flex justify-between"><span>Cuidador recebe</span><strong>{formatCentsBRL(fees.baseCents)}</strong></p>
              <p className="flex justify-between"><span>Taxa VIRLA (7% + R$ 0,80)</span><span>{formatCentsBRL(fees.platformFeeCents + fees.fixedFeeCents)}</span></p>
              <p className="flex justify-between border-t border-virla-roxo/10 pt-2 text-virla-roxo"><strong>Total do familiar</strong><strong>{formatCentsBRL(fees.totalCents)}</strong></p>
            </div>
          )}

          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" icon={Assignment} loading={loading}>Enviar para assinatura</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
