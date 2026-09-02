import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Close from '@mui/icons-material/Close'
import Draw from '@mui/icons-material/Draw'
import Payments from '@mui/icons-material/Payments'
import CheckCircle from '@mui/icons-material/CheckCircle'
import api from '../../services/api'
import { Alert, Badge, Button, Field } from '../ui'
import { formatCentsBRL } from '../../utils/paymentFees'
import { formatDateOnly } from '../../utils/formatters'
import { paymentRecurrenceLabel } from '../../constants/solicitacaoOptions'
import { daysUntilPayment, paymentCountdownLabel } from '../../utils/paymentSchedule'

const STATUS = {
  PENDING_SIGNATURE: ['Aguardando assinatura', 'amber'],
  SIGNED: ['Assinado', 'green'],
  PAYMENT_PENDING: ['Pagamento iniciado', 'blue'],
  PAID: ['Pago', 'green'],
  REFUND_PENDING: ['Reembolso em andamento', 'amber'],
  REFUNDED: ['Reembolsado', 'gray'],
  DISPUTED: ['Em disputa', 'red'],
}

function formatSignedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ServiceReportReviewModal({ solicitacao, onClose, onUpdated, apiClient = api, onDemoPayment }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [typedName, setTypedName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [declaration, setDeclaration] = useState(false)

  useEffect(() => {
    apiClient.get(`/service-reports/solicitacao/${solicitacao.id}`)
      .then((response) => setReport(response.data.report))
      .catch((err) => setError(err.response?.data?.msg ?? 'Não foi possível carregar o relatório.'))
      .finally(() => setLoading(false))
  }, [apiClient, solicitacao.id])

  async function sign() {
    setBusy(true)
    setError('')
    try {
      const response = await apiClient.post(`/service-reports/${report.id}/sign`, {
        accepted,
        declaration,
        typedName,
      })
      setReport(response.data.report)
      onUpdated?.(response.data.report)
    } catch (err) {
      setError(err.response?.data?.msg ?? 'Não foi possível assinar o relatório.')
    } finally {
      setBusy(false)
    }
  }

  async function pay() {
    setBusy(true)
    setError('')
    try {
      if (onDemoPayment) {
        const updatedReport = await onDemoPayment(report)
        setReport(updatedReport)
        onUpdated?.(updatedReport)
        return
      }
      const response = await apiClient.post('/payments/checkout-sessions', { reportId: report.id })
      sessionStorage.setItem('virla_pag_sessao', 'true')
      window.location.assign(response.data.url)
    } catch (err) {
      setError(err.response?.data?.msg ?? 'Não foi possível abrir o pagamento.')
      setBusy(false)
    }
  }

  const status = STATUS[report?.status] ?? [report?.status ?? '', 'gray']
  const paymentDue = report ? !report.paymentDueDate || daysUntilPayment(report.paymentDueDate) === 0 : false

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="review-title" className="text-xl font-display font-black text-virla-roxo">Confirmação do serviço</h2>
            <p className="text-sm text-virla-muted mt-1">Revise o relatório antes de assinar e pagar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-lg hover:bg-virla-roxo/10"><Close /></button>
        </div>

        {loading && <p className="text-sm text-virla-muted">Carregando relatório…</p>}
        {!loading && !report && <Alert tone="info">O cuidador ainda não enviou o relatório deste serviço. O pagamento permanecerá bloqueado.</Alert>}

        {report && (
          <>
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <Badge tone={status[1]}>{status[0]}</Badge>
              <span className="text-sm font-bold text-virla-roxo">Total: {formatCentsBRL(report.totalAmount)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-virla-roxo/5 p-3"><span className="block text-xs text-virla-muted">Data</span><strong>{report.serviceDate}</strong></div>
              <div className="rounded-xl bg-virla-roxo/5 p-3"><span className="block text-xs text-virla-muted">Início</span><strong>{report.startedAt}</strong></div>
              <div className="rounded-xl bg-virla-roxo/5 p-3"><span className="block text-xs text-virla-muted">Término</span><strong>{report.endedAt}</strong></div>
            </div>
            {report.paymentDueDate && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-virla-roxo/5 p-3"><span className="block text-xs text-virla-muted">Recorrência do contrato</span><strong>{paymentRecurrenceLabel(report.paymentRecurrence)}</strong></div>
                <div className="rounded-xl bg-virla-roxo/5 p-3"><span className="block text-xs text-virla-muted">Pagamento previsto</span><strong>{formatDateOnly(report.paymentDueDate)} ({paymentCountdownLabel(report.paymentDueDate)})</strong></div>
              </div>
            )}
            <section className="space-y-3 text-sm">
              <div><h3 className="font-bold text-virla-texto">Atividades realizadas</h3><p className="whitespace-pre-wrap text-virla-muted">{report.activities}</p></div>
              <div><h3 className="font-bold text-virla-texto">Observações</h3><p className="whitespace-pre-wrap text-virla-muted">{report.observations || 'Sem observações.'}</p></div>
              <div><h3 className="font-bold text-virla-texto">Intercorrências</h3><p className="whitespace-pre-wrap text-virla-muted">{report.incidents || 'Nenhuma intercorrência registrada.'}</p></div>
            </section>

            {report.signature?.signedAt && report.reportHash && (
              <section aria-label="Comprovante da assinatura" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm space-y-1">
                <h3 className="font-bold text-green-900">Assinatura eletrônica confirmada</h3>
                <p className="text-green-800">Assinado por <strong>{report.signature.signedByName}</strong> em {formatSignedAt(report.signature.signedAt)}.</p>
                <p className="break-all font-mono text-xs text-green-700">Integridade: {report.reportHash}</p>
              </section>
            )}

            {report.status === 'PENDING_SIGNATURE' && (
              <div className="border-t border-virla-roxo/10 pt-4 space-y-3">
                <Alert tone="warning">Ao assinar, você confirma que revisou o relatório e que o serviço descrito foi prestado. Essa ação é auditável e não pode ser desfeita.</Alert>
                <label className="flex gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> Confirmo que o serviço foi prestado no dia e horário informados.</label>
                <label className="flex gap-2 text-sm"><input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} /> Aceito assinar eletronicamente este relatório com minha conta VIRLA.</label>
                <Field label="Assinatura — digite seu nome completo" required value={typedName} onChange={(e) => setTypedName(e.target.value)} maxLength={120} />
                <Button icon={Draw} loading={busy} disabled={!accepted || !declaration || typedName.trim().length < 3} onClick={sign}>Confirmar e assinar</Button>
              </div>
            )}

            {['SIGNED', 'PAYMENT_PENDING'].includes(report.status) && paymentDue && (
              <div className="border-t border-virla-roxo/10 pt-4 space-y-3">
                <Alert tone="success">Relatório assinado. O pagamento está liberado e será processado com segurança pela Stripe.</Alert>
                <Button fullWidth icon={Payments} loading={busy} onClick={pay}>
                  {onDemoPayment ? 'Simular pagamento de teste' : report.status === 'PAYMENT_PENDING' ? 'Continuar pagamento' : 'Pagar com Stripe'}
                </Button>
              </div>
            )}

            {['SIGNED', 'PAYMENT_PENDING'].includes(report.status) && !paymentDue && report.paymentDueDate && (
              <div className="border-t border-virla-roxo/10 pt-4">
                <Alert tone="info">Relatório assinado. Conforme o contrato, o pagamento ficará disponível {paymentCountdownLabel(report.paymentDueDate)}, em {formatDateOnly(report.paymentDueDate)}.</Alert>
              </div>
            )}

            {report.status === 'PAID' && <Alert tone="success"><span className="inline-flex items-center gap-2"><CheckCircle fontSize="small" />Pagamento confirmado.</span></Alert>}
          </>
        )}

        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </div>,
    document.body,
  )
}
