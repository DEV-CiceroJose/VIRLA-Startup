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
import { FIELD_CLASS } from '../../constants/formStyles'
import { ButtonSpinner, InlineSpinner } from '../../components/Spinner'
import { maskCpf, isValidCpf } from '../../utils/validators'
import { formatCentsBRL } from '../../utils/paymentFees'

function StatusPill({ status }) {
  const map = {
    PENDING: { label: 'Aguardando pagamento', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    ACTIVE: { label: 'Aguardando pagamento', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    PAID: { label: 'Pago', color: 'bg-green-50 text-green-700 border-green-200' },
    EXPIRED: { label: 'Expirado', color: 'bg-red-50 text-red-700 border-red-200' },
    CANCELED: { label: 'Cancelado', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  }
  const { label, color } = map[status] ?? map.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${color}`}>
      <Schedule sx={{ fontSize: 14 }} />
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

  return (
    <div className="min-h-screen pt-16 bg-virla-neve flex items-start justify-center px-4 py-10"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(128,0,128,0.10), transparent)' }}
    >
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-virla-roxo hover:bg-virla-roxo/10 transition-colors"
          >
            <ArrowBack sx={{ fontSize: 22 }} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-black text-virla-roxo">
              Pagamento via PIX
            </h1>
            <p className="text-virla-texto/50 text-sm">Valor com taxas da plataforma (7% + R$ 0,80)</p>
          </div>
        </div>

        <div className="bg-virla-roxo rounded-2xl p-5 text-white shadow-lg">
          <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-1">{description}</p>
          {baseAmount != null && (
            <p className="text-white/60 text-xs mb-1">
              Base: {formatCentsBRL(baseAmount)} · Total:
            </p>
          )}
          <p className="text-4xl font-display font-black">
            {amount != null ? formatCentsBRL(amount) : '—'}
          </p>
          {billing && (
            <div className="mt-3">
              <StatusPill status={status} />
            </div>
          )}
        </div>

        {!billing && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-virla-roxo/10 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-virla-texto flex items-center gap-2">
              <VerifiedUser sx={{ fontSize: 20 }} className="text-virla-roxo" />
              Dados para emissão do PIX
            </h2>

            {error && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <ErrorIcon sx={{ fontSize: 18 }} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-virla-texto/60 uppercase tracking-wide mb-1.5">
                CPF *
              </label>
              <div className="relative">
                <VerifiedUser sx={{ fontSize: 16 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-virla-roxo/40 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={taxId}
                  onChange={(e) => setTaxId(maskCpf(e.target.value))}
                  className={`${FIELD_CLASS} pl-9`}
                  maxLength={14}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-virla-texto/60 uppercase tracking-wide mb-1.5">
                Celular (opcional)
              </label>
              <div className="relative">
                <Smartphone sx={{ fontSize: 16 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-virla-roxo/40 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="(81) 99999-9999"
                  value={cellphone}
                  onChange={(e) => setCellphone(maskPhone(e.target.value))}
                  className={`${FIELD_CLASS} pl-9`}
                  maxLength={15}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGeneratePIX}
              disabled={loading || !canPay}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-virla-roxo hover:bg-virla-roxohighlight text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <> <ButtonSpinner size={20} /> Gerando PIX… </>
              ) : (
                <> <QrCode sx={{ fontSize: 20 }} /> Gerar QR Code PIX </>
              )}
            </button>
          </div>
        )}

        {billing && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-virla-roxo/10 shadow-sm p-6 space-y-5">
            {billing.qrCodeBase64 ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-virla-texto/60 uppercase tracking-widest">
                  Escaneie o QR Code
                </p>
                <div className="p-3 rounded-2xl border-2 border-virla-roxo/15 bg-white shadow-inner">
                  <img
                    src={`data:image/png;base64,${billing.qrCodeBase64}`}
                    alt="PIX QR Code"
                    className="w-48 h-48 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-virla-texto/40">
                <QrCode sx={{ fontSize: 48 }} className="text-virla-roxo/20" />
                <p className="text-sm">QR Code não disponível. Use o código abaixo.</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-virla-texto/30 text-xs font-medium uppercase tracking-widest">
              <div className="flex-1 h-px bg-virla-roxo/10" /> ou copie o código <div className="flex-1 h-px bg-virla-roxo/10" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-virla-texto/60 uppercase tracking-widest">PIX Copia e Cola</p>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-virla-roxo/5 border border-virla-roxo/15 text-xs text-virla-texto/70 font-mono break-all select-all leading-relaxed">
                  {billing.pixCode || '—'}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!billing.pixCode}
                  className={`flex-shrink-0 w-12 rounded-xl flex items-center justify-center transition-all duration-200 ${copied ? 'bg-green-500 text-white' : 'bg-virla-roxo text-white hover:bg-virla-roxohighlight'} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {copied ? <DoneAll sx={{ fontSize: 20 }} /> : <ContentCopy sx={{ fontSize: 20 }} />}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <DoneAll sx={{ fontSize: 14 }} /> Código copiado! Cole no app do seu banco.
                </p>
              )}
            </div>

            {!isExpired && status !== 'PAID' && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <InlineSpinner size={18} />
                <span>Aguardando confirmação do pagamento. Esta página atualiza automaticamente.</span>
              </div>
            )}

            {isExpired && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <ErrorIcon sx={{ fontSize: 18 }} className="flex-shrink-0 mt-0.5" />
                  <span>QR Code expirado. Gere um novo código para concluir o pagamento.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBilling(null)
                    setStatus('PENDING')
                    setExpiredByTimer(false)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-virla-roxo/20 text-virla-roxo hover:bg-virla-roxo/5"
                >
                  <Replay sx={{ fontSize: 18 }} /> Gerar novo QR Code
                </button>
              </div>
            )}

            {status === 'PAID' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
                <DoneAll sx={{ fontSize: 20 }} className="flex-shrink-0" />
                Pagamento confirmado! Redirecionando…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}