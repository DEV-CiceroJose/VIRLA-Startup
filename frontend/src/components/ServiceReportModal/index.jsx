import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Close from '@mui/icons-material/Close'
import Assignment from '@mui/icons-material/Assignment'
import api from '../../services/api'
import { Alert, Button, DatePickerField, Field, TimePickerField } from '../ui'
import { formatCentsBRL } from '../../utils/paymentFees'
import { formatDateOnly, formatHourly } from '../../utils/formatters'
import { paymentRecurrenceLabel } from '../../constants/solicitacaoOptions'
import { calculateContractAmountCents, calculatePaymentDueDate, paymentCountdownLabel } from '../../utils/paymentSchedule'

function localDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function ServiceReportModal({ solicitacao, onClose, onCreated, apiClient = api }) {
  const contractStartDate = String(solicitacao.dataInicio ?? '').slice(0, 10)
  const latestServiceDate = localDate()
  const reportIsAvailable = !contractStartDate || contractStartDate <= latestServiceDate
  const [form, setForm] = useState({
    serviceDate: reportIsAvailable ? latestServiceDate : '',
    startedAt: '08:00',
    endedAt: '16:00',
    activities: '',
    observations: '',
    incidents: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const contractAmount = useMemo(() => calculateContractAmountCents({
    hourlyRate: solicitacao.valorHora,
    startedAt: form.startedAt,
    endedAt: form.endedAt,
  }), [form.endedAt, form.startedAt, solicitacao.valorHora])
  const paymentDueDate = useMemo(() => calculatePaymentDueDate({
    contractStartDate: solicitacao.dataInicio,
    serviceDate: form.serviceDate,
    paymentRecurrence: solicitacao.paymentRecurrence,
  }), [form.serviceDate, solicitacao.dataInicio, solicitacao.paymentRecurrence])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!reportIsAvailable) {
      setError(`Este relatório poderá ser preenchido a partir de ${formatDateOnly(contractStartDate)}.`)
      return
    }
    if (!form.serviceDate || (contractStartDate && form.serviceDate < contractStartDate) || form.serviceDate > latestServiceDate) {
      setError('Escolha uma data dentro do período válido do contrato.')
      return
    }
    if (!form.startedAt || !form.endedAt || form.endedAt <= form.startedAt) {
      setError('O horário de término precisa ser posterior ao horário de início.')
      return
    }
    if (!contractAmount || !paymentDueDate) {
      setError('Confira os horários e os dados de pagamento definidos na solicitação.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.post('/service-reports', {
        solicitacaoId: solicitacao.id,
        serviceDate: form.serviceDate,
        startedAt: form.startedAt,
        endedAt: form.endedAt,
        activities: form.activities,
        observations: form.observations,
        incidents: form.incidents,
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
          {!reportIsAvailable && (
            <Alert tone="warning">
              O contrato começa em {formatDateOnly(contractStartDate)}. O relatório ficará disponível nessa data; assim evitamos registrar um serviço antes do início combinado.
            </Alert>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DatePickerField
              label="Data do serviço"
              required
              min={reportIsAvailable ? contractStartDate || undefined : undefined}
              max={reportIsAvailable ? latestServiceDate : undefined}
              value={form.serviceDate}
              onChange={set('serviceDate')}
              disabled={!reportIsAvailable}
              placeholder={reportIsAvailable ? 'Escolha a data' : 'Aguarde o contrato'}
            />
            <TimePickerField label="Início" required value={form.startedAt} onChange={set('startedAt')} disabled={!reportIsAvailable} />
            <TimePickerField
              label="Término"
              required
              value={form.endedAt}
              onChange={set('endedAt')}
              disabled={!reportIsAvailable}
              error={form.endedAt && form.startedAt && form.endedAt <= form.startedAt ? 'Deve ser após o início.' : ''}
            />
          </div>
          <Field label="Atividades realizadas" required as="textarea" rows={5} maxLength={4000} value={form.activities} onChange={set('activities')} placeholder="Descreva alimentação, medicação, higiene, acompanhamento e demais atividades..." />
          <Field label="Observações" as="textarea" rows={3} maxLength={3000} value={form.observations} onChange={set('observations')} placeholder="Como a pessoa assistida passou o dia?" />
          <Field label="Intercorrências" as="textarea" rows={3} maxLength={3000} value={form.incidents} onChange={set('incidents')} placeholder="Registre qualquer ocorrência relevante ou informe que não houve." />
          {contractAmount && paymentDueDate && (
            <div className="rounded-xl border border-virla-roxo/10 bg-virla-roxo/5 p-4 text-sm space-y-1">
              <p className="flex justify-between"><span>Valor do contrato</span><strong>{formatHourly(solicitacao.valorHora)}</strong></p>
              <p className="flex justify-between"><span>Período informado</span><strong>{form.startedAt}–{form.endedAt}</strong></p>
              <p className="flex justify-between"><span>Recorrência</span><strong>{paymentRecurrenceLabel(solicitacao.paymentRecurrence)}</strong></p>
              <p className="flex justify-between"><span>Previsão do recebimento</span><strong>{formatDateOnly(paymentDueDate)} ({paymentCountdownLabel(paymentDueDate)})</strong></p>
              <p className="flex justify-between border-t border-virla-roxo/10 pt-2 text-virla-roxo"><strong>Valor deste relatório</strong><strong>{formatCentsBRL(contractAmount)}</strong></p>
              <p className="text-xs text-virla-muted">Calculado automaticamente pelo contrato. Não há taxa adicional da VIRLA.</p>
            </div>
          )}

          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" icon={Assignment} loading={loading} disabled={!reportIsAvailable}>Enviar para assinatura</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
