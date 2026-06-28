/**
 * Selo/etiqueta compacta do Design System Virla.
 * Variantes semânticas para papéis e estados.
 */
const TONES = {
  roxo: 'bg-virla-roxo/10 text-virla-roxo',
  violet: 'bg-violet-100 text-violet-800 border border-violet-200/80',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200',
  red: 'bg-red-50 text-red-700 border border-red-200',
  gray: 'bg-gray-100 text-gray-600',
  onDark: 'bg-white/20 text-white border border-white/25 backdrop-blur-sm',
}

export default function Badge({ tone = 'roxo', icon: Icon, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
        TONES[tone] ?? TONES.roxo
      } ${className}`}
    >
      {Icon && <Icon sx={{ fontSize: 13 }} aria-hidden />}
      {children}
    </span>
  )
}
