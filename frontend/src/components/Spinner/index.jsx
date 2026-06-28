import CircularProgress from '@mui/material/CircularProgress'

const VIRLA_SPINNER_COLOR = 'rgb(128, 0, 128)'

/** Spinner padrão Virla — use em botões, overlays e páginas inteiras. */
export function Spinner({
  size = 40,
  label,
  color = VIRLA_SPINNER_COLOR,
  className = '',
  labelClassName = 'text-sm text-virla-texto/50',
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <CircularProgress size={size} sx={{ color }} aria-hidden />
      {label ? <p className={labelClassName}>{label}</p> : null}
    </div>
  )
}

/** Tela cheia com spinner central (carregamento de API / banco). */
export function PageLoader({
  label = 'Carregando…',
  className = 'min-h-screen pt-16 bg-virla-neve flex flex-col items-center justify-center gap-4 px-6',
  children,
}) {
  return (
    <div className={className}>
      <Spinner label={label} />
      {children}
    </div>
  )
}

/** Spinner branco dentro de botões (login, cadastro, pagamento). */
export function ButtonSpinner({ size = 20 }) {
  return <CircularProgress size={size} sx={{ color: 'white' }} aria-hidden />
}

/** Spinner compacto inline (botões, cabeçalhos). */
export function InlineSpinner({ size = 16 }) {
  return <CircularProgress size={size} sx={{ color: VIRLA_SPINNER_COLOR }} aria-hidden />
}

/** Overlay semitransparente sobre conteúdo (paginação, atualização). */
export function LoadingOverlay({ label = 'Atualizando…' }) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl
                 bg-virla-neve/60 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <Spinner size={32} label={label} />
    </div>
  )
}
