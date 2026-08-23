import { useCallback, useEffect, useState } from 'react'
import AccountBalance from '@mui/icons-material/AccountBalance'
import OpenInNew from '@mui/icons-material/OpenInNew'
import api from '../../services/api'
import { Alert, Button, Card } from '../ui'

export default function StripeConnectCard() {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get('/stripe/connect/status')
      .then((response) => setStatus(response.data))
      .catch((err) => setError(err.response?.data?.msg ?? 'Não foi possível consultar seus recebimentos.'))
  }, [])

  useEffect(load, [load])

  async function open(path) {
    setBusy(true)
    setError('')
    try {
      const response = await api.post(path)
      window.location.assign(response.data.url)
    } catch (err) {
      setError(err.response?.data?.msg ?? 'Não foi possível abrir a Stripe.')
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 border border-virla-roxo/15 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-virla-roxo flex items-center gap-2"><AccountBalance fontSize="small" /> Recebimentos pela Stripe</h2>
          <p className="text-sm text-virla-muted mt-1">A VIRLA não recebe nem armazena seus dados bancários.</p>
        </div>
        {status?.ready ? (
          <Button size="sm" variant="secondary" icon={OpenInNew} loading={busy} onClick={() => open('/stripe/connect/dashboard-link')}>Ver recebimentos</Button>
        ) : (
          <Button size="sm" icon={OpenInNew} loading={busy} onClick={() => open('/stripe/connect/onboarding')}>{status?.connected ? 'Continuar cadastro' : 'Cadastrar recebimento'}</Button>
        )}
      </div>
      {status?.ready && <Alert tone="success">Cadastro concluído. Você está apto a receber pagamentos dos serviços confirmados.</Alert>}
      {status?.connected && !status.ready && <Alert tone="warning">Há informações pendentes na Stripe. Conclua o cadastro antes de receber.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  )
}

