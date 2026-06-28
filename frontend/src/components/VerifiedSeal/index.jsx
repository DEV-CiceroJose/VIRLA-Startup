import CheckCircle from '@mui/icons-material/CheckCircle'

/** Selo de verificado quando o perfil possui CRM/CRF cadastrado. */
export function hasVerifiedCrm(user) {
  const v = user?.crm_crf
  return typeof v === 'string' && v.trim().length > 0
}

export default function VerifiedSeal({ user, className = '', iconSize = 20 }) {
  if (!hasVerifiedCrm(user)) return null

  return (
    <span
      className={`inline-flex items-center text-emerald-600 ${className}`}
      title="Profissional verificado (CRM/CRF)"
      aria-label="Profissional verificado"
    >
      <CheckCircle sx={{ fontSize: iconSize }} />
    </span>
  )
}
