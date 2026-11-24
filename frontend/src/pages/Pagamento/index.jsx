import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ArrowBack from '@mui/icons-material/ArrowBack'
import QrCode from '@mui/icons-material/QrCode'
import ContentCopy from '@mui/icons-material/ContentCopy'
import DoneAll from '@mui/icons-material/DoneAll'
import ErrorIcon from '@mui/icons-material/Error'
import VerifiedUser from '@mui/icons-material/VerifiedUser'
import Schedule from '@mui/icons-material/Schedule'
import Smartphone from '@mui/icons-material/Smartphone'
import Replay from '@mui/icons-material/Replay'
import { toast } from 'sonner'
import api from '../../services/api'
import { ButtonSpinner, InlineSpinner } from '../../components/Spinner'
import { maskCpf, isValidCpf } from '../../utils/validators'
import { formatCentsBRL } from '../../utils/paymentFees'
import '../../design-system/payment.css'

function StatusPill({ status }) {
  const map = {
    PENDING: { label: 'Aguardando pagamento', tone: 'wait' },
    ACTIVE: { label: 'Aguardando pagamento', tone: 'wait' },
    PAID: { label: 'Pago', tone: 'ok' },
    EXPIRED: { label: 'Expirado', tone: 'risk' },
    CANCELED: { label: 'Cancelado', tone: 'muted' },
  }
  const { label, tone } = map[status] ?? map.PENDING
  return (
    <span className={`pg-pill tone-${tone}`}>
      <Schedule aria-hidden />
      {label}
    </span>
  )
}
export default function Pagamento() {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    amount,
    baseAmount,
    description = 'Serviço Virla',
    payeeId,
    chargeRequestId,
  } = location.state ?? {}

  const [taxId, setTaxId] = useState('')
  const [cellphone, setCellphone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [billing, setBilling] = useState(null)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('PENDING')
  const [expiredByTimer, setExpiredByTimer] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const pollRef = useRef(null)
  const myRole = localStorage.getItem('meuRole')

  useEffect(() => {
    if (myRole && myRole !== 'FAMILIAR') {
      setError('Apenas familiares podem executar o pagamento. Peça ao cuidador para gerar a cobrança.')
    }
  }, [myRole])

  // Polling de status
  useEffect(() => {
    if (!billing?.billingId || status === 'PAID') return

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/payments/billing/${billing.billingId}/status`)
        const s = res.data.status
        setStatus(s)
        
        if (s === 'PAID') {
          clearInterval(pollRef.current)
          sessionStorage.setItem('virla_pag_sessao', 'true')
          toast.success('Pagamento aprovado com sucesso!')
          
          setTimeout(() => {
            navigate('/pagamento/sucesso', {
              state: {
                billingId: billing.billingId,
                amount,
                description,
                paidAt: res.data.paidAt ?? new Date().toISOString(),
                status: s,
              }
            })
          }, 1000)
        } else if (s === 'EXPIRED' || s === 'CANCELED') {
          clearInterval(pollRef.current)
          toast.warning('Esse QR Code expirou. Gere um novo para continuar.')
        }
      } catch {
        // silencia erros transitórios
      }
    }, 5000)

    return () => clearInterval(pollRef.current)
  }, [billing, status, navigate, amount, description])

  useEffect(() => {
    if (!billing?.expiresAt || status === 'PAID') return
    const timeoutMs = new Date(billing.expiresAt).getTime() - Date.now()
    if (timeoutMs <= 0) {
      setExpiredByTimer(true)
      setStatus('EXPIRED')
      return
    }
    const t = setTimeout(() => {
      setExpiredByTimer(true)
      setStatus('EXPIRED')
      toast.warning('QR Code expirado após 5 minutos.')
    }, timeoutMs)
    return () => clearTimeout(t)
  }, [billing, status])

  // Relógio da contagem regressiva do QR Code (só exibição).
  useEffect(() => {
    if (!billing?.expiresAt || status === 'PAID') return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [billing, status])

  function maskPhone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
  }

  async function handleGeneratePIX() {
    setError('')
    const rawTaxId = taxId.replace(/\D/g, '')
    if (!isValidCpf(rawTaxId)) {
      setError('Informe um CPF válido (11 dígitos com verificação).')
      return
    }
    if (!amount || !payeeId) {
      setError('Cobrança inválida. Volte ao chat e tente novamente.')
      return
    }
    if (myRole && myRole !== 'FAMILIAR') {
      setError('Apenas familiares podem pagar.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/payments/billing', {
        amount,
        description,
        taxId: rawTaxId,
        cellphone: cellphone.replace(/\D/g, '') || undefined,
        payeeId,
        chargeRequestId,
      })
      
      sessionStorage.setItem('virla_pag_sessao', 'true')
      setBilling(res.data)
      const initialStatus = res.data.status === 'ACTIVE' ? 'PENDING' : (res.data.status ?? 'PENDING')
      setStatus(initialStatus)
    } catch (err) {
      setError(err.response?.data?.msg ?? 'Erro ao gerar o PIX. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!billing?.pixCode) return
    try {
      await navigator.clipboard.writeText(billing.pixCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      const el = document.createElement('textarea')
      el.value = billing.pixCode
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const canPay = amount && payeeId && (!myRole || myRole === 'FAMILIAR')
  const isExpired = status === 'EXPIRED' || status === 'CANCELED' || expiredByTimer
  const step = status === 'PAID' ? 3 : billing ? 2 : 1
  const remainingMs = billing?.expiresAt && !isExpired && status !== 'PAID'
    ? Math.max(0, new Date(billing.expiresAt).getTime() - now)
    : null
  const countdown = remainingMs != null
    ? `${Math.floor(remainingMs / 60000)}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}`
    : null

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash pg-page">
        <header className="pg-header">
          <button type="button" onClick={() => navigate(-1)} className="pg-back" aria-label="Voltar">
            <ArrowBack aria-hidden />
          </button>
          <div className="vd-greeting">
            <h1>Pagamento via PIX</h1>
            <p>Valor do serviço, sem taxa adicional da VIRLA.</p>
          </div>
        </header>

        <div className="pg-layout">
          <aside className="pg-summary">
            <div className="vd-card vd-card-dark pg-amount">
              <span className="pg-amount-label">{description}</span>
              <strong>{amount != null ? formatCentsBRL(amount) : '—'}</strong>
              {baseAmount != null && <span className="pg-amount-base">Base do serviço: {formatCentsBRL(baseAmount)}</span>}
              {billing && <StatusPill status={status} />}
            </div>

            <ol className="pg-steps" aria-label="Etapas do pagamento">
              {['Seus dados', 'Pague com PIX', 'Confirmação'].map((label, index) => {
                const n = index + 1
                const state = n < step ? 'is-done' : n === step ? 'is-current' : ''
                return (
                  <li key={label} className={`pg-step ${state}`} aria-current={n === step ? 'step' : undefined}>
                    <span className="pg-step-dot" aria-hidden="true">{n < step ? <DoneAll /> : n}</span>
                    <span>{label}</span>
                  </li>
                )
              })}
            </ol>

            <p className="pg-safe"><VerifiedUser aria-hidden /> Pague só por aqui: a VIRLA não reconhece pagamentos feitos fora da plataforma.</p>
          </aside>

          <section className="pg-main" aria-live="polite">
            {!billing && (
              <div className="pg-panel">
                <h2>Dados para emitir o PIX</h2>
                <p className="pg-lede">Usamos o CPF de quem paga só para gerar a cobrança.</p>

                {error && (
                  <div className="pg-error" role="alert">
                    <ErrorIcon aria-hidden />
                    {error}
                  </div>
                )}

                <div className="pg-field">
                  <label htmlFor="pg-cpf">CPF <span aria-hidden="true">*</span></label>
                  <div className="pg-input">
                    <VerifiedUser aria-hidden />
                    <input
                      id="pg-cpf"
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={taxId}
                      onChange={(e) => setTaxId(maskCpf(e.target.value))}
                      maxLength={14}
                      required
                    />
                  </div>
                </div>

                <div className="pg-field">
                  <label htmlFor="pg-phone">Celular (opcional)</label>
                  <div className="pg-input">
                    <Smartphone aria-hidden />
                    <input
                      id="pg-phone"
                      type="text"
                      inputMode="numeric"
                      placeholder="(81) 99999-9999"
                      value={cellphone}
                      onChange={(e) => setCellphone(maskPhone(e.target.value))}
                      maxLength={15}
                    />
                  </div>
                </div>

                <button type="button" onClick={handleGeneratePIX} disabled={loading || !canPay} className="pg-primary">
                  {loading ? <><ButtonSpinner size={20} /> Gerando PIX…</> : <><QrCode aria-hidden /> Gerar QR Code PIX</>}
                </button>
              </div>
            )}

            {billing && (
              <div className="pg-panel">
                <div className="pg-qr-head">
                  <h2>Escaneie o QR Code</h2>
                  {countdown && <span className="pg-timer" aria-label={`Expira em ${countdown}`}><Schedule aria-hidden /> {countdown}</span>}
                </div>

                {billing.qrCodeBase64 ? (
                  <div className={`pg-qr${isExpired ? ' is-expired' : ''}`}>
                    <img src={`data:image/png;base64,${billing.qrCodeBase64}`} alt="QR Code do PIX" />
                  </div>
                ) : (
                  <div className="pg-qr is-missing">
                    <QrCode aria-hidden />
                    <p>QR Code indisponível. Use o código abaixo.</p>
                  </div>
                )}

                <div className="pg-divider"><span>ou copie o código</span></div>

                <div className="pg-copy">
                  <p className="pg-copy-label">PIX copia e cola</p>
                  <div className="pg-copy-row">
                    <code>{billing.pixCode || '—'}</code>
                    <button type="button" onClick={handleCopy} disabled={!billing.pixCode} className={copied ? 'is-copied' : ''} aria-label={copied ? 'Código copiado' : 'Copiar código PIX'}>
                      {copied ? <DoneAll aria-hidden /> : <ContentCopy aria-hidden />}
                    </button>
                  </div>
                  {copied && <p className="pg-copied"><DoneAll aria-hidden /> Código copiado! Cole no app do seu banco.</p>}
                </div>

                {!isExpired && status !== 'PAID' && (
                  <div className="pg-wait">
                    <InlineSpinner size={18} />
                    <span>Aguardando a confirmação do banco. Esta página atualiza sozinha.</span>
                  </div>
                )}

                {isExpired && (
                  <div className="pg-expired">
                    <div className="pg-error" role="alert">
                      <ErrorIcon aria-hidden />
                      <span>QR Code expirado. Gere um novo código para concluir o pagamento.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBilling(null)
                        setStatus('PENDING')
                        setExpiredByTimer(false)
                      }}
                      className="pg-secondary"
                    >
                      <Replay aria-hidden /> Gerar novo QR Code
                    </button>
                  </div>
                )}

                {status === 'PAID' && (
                  <div className="pg-paid">
                    <DoneAll aria-hidden />
                    Pagamento confirmado! Redirecionando…
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}