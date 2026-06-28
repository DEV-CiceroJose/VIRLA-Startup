import CheckCircle from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import WarningAmber from '@mui/icons-material/WarningAmber'

/**
 * Mensagem de feedback inline (sucesso/erro/aviso/info) padronizada.
 * Para notificações efêmeras use o toast (sonner); este componente é para
 * mensagens persistentes dentro do fluxo (ex.: erro de formulário).
 */
const TONES = {
  success: {
    box: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
  },
  error: {
    box: 'bg-red-50 border-red-200 text-red-700',
    icon: ErrorIcon,
    iconColor: 'text-red-500',
  },
  warning: {
    box: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: WarningAmber,
    iconColor: 'text-amber-500',
  },
  info: {
    box: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: InfoIcon,
    iconColor: 'text-blue-500',
  },
}

export default function Alert({ tone = 'info', title, children, className = '', icon }) {
  const cfg = TONES[tone] ?? TONES.info
  const Icon = icon ?? cfg.icon
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${cfg.box} ${className}`}
    >
      <Icon sx={{ fontSize: 20 }} className={`flex-shrink-0 mt-0.5 ${cfg.iconColor}`} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  )
}
