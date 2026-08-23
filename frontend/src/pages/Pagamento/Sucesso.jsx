import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Home from '@mui/icons-material/Home'
import Download from '@mui/icons-material/Download'
import api from '../../services/api'
import { Alert, Button } from '../../components/ui'
import { PageLoader } from '../../components/Spinner'
import { formatCentsBRL } from '../../utils/paymentFees'

export default function PagamentoSucesso() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(sessionId ? '' : 'Sessão de pagamento inválida.')

  useEffect(() => {
    if (!sessionId) {
      return undefined
    }
    let stopped = false
    let attempts = 0
    let timer

    async function check() {
      try {
        const response = await api.get(`/payments/checkout-sessions/${sessionId}/status`)
        if (stopped) return
        setReceipt(response.data)
        if (response.data.status === 'PAID') {
          sessionStorage.removeItem('virla_pag_sessao')
          return
        }
        if (['FAILED', 'EXPIRED'].includes(response.data.status)) {
          setError('O pagamento não foi concluído. Volte ao relatório e tente novamente.')
          return
        }
        attempts += 1
        if (attempts < 20) timer = setTimeout(check, 2500)
        else setError('A confirmação está demorando. Consulte novamente em alguns instantes.')
      } catch (err) {
        if (!stopped) setError(err.response?.data?.msg ?? 'Não foi possível confirmar o pagamento.')
      }
    }
    check()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [sessionId])

  function downloadReceipt() {
    if (!receipt) return
    const paidAt = receipt.paidAt ? new Date(receipt.paidAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
    const text = [
      'VIRLA — Comprovante digital',
      `Status: ${receipt.status}`,
      `Valor: ${formatCentsBRL(receipt.amount)}`,
      `Relatório: ${receipt.reportId}`,
      `Pagamento Stripe: ${receipt.paymentIntentId ?? '-'}`,
      `Data/Hora: ${paidAt}`,
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `comprovante-virla-${receipt.reportId}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!receipt && !error) return <PageLoader label="Confirmando pagamento com a Stripe…" />
  const paid = receipt?.status === 'PAID'

  return (
    <div className="min-h-screen pt-16 bg-virla-neve flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6 animate-fade-up">
        {paid && (
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
              <CheckCircle sx={{ fontSize: 48 }} className="text-emerald-500" aria-hidden />
            </div>
          </div>
        )}
        <div>
          <h1 className="text-3xl font-display font-black text-virla-roxo">
            {paid ? 'Pagamento confirmado!' : 'Confirmando pagamento'}
          </h1>
          <p className="text-virla-muted text-sm mt-2">
            {paid ? 'A Stripe confirmou o pagamento e o repasse ao cuidador foi iniciado.' : 'Aguardando a confirmação segura da Stripe.'}
          </p>
        </div>
        {receipt && <p className="text-2xl font-bold text-virla-roxo">{formatCentsBRL(receipt.amount)}</p>}
        {error && <Alert tone="warning">{error}</Alert>}
        <div className="flex flex-col gap-3">
          {paid && <Button variant="success" fullWidth icon={Download} onClick={downloadReceipt}>Baixar comprovante</Button>}
          <Button fullWidth icon={Home} onClick={() => navigate('/solicitacoes')}>Voltar às solicitações</Button>
        </div>
      </div>
    </div>
  )
}
