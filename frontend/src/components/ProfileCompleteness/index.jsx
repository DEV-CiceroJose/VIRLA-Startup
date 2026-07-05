import { computeCompleteness } from './completeness'

export default function ProfileCompleteness({ userData, role }) {
  const { percent, missing } = computeCompleteness(userData, role)
  if (percent === 100) return null

  return (
    <div className="bg-white/80 rounded-2xl border border-virla-roxo/10 p-4 space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-virla-texto">
        <span>Perfil {percent}% completo</span>
      </div>
      <div className="w-full h-2 rounded-full bg-virla-roxo/10 overflow-hidden">
        <div
          className="h-full bg-virla-roxo rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {missing.length > 0 && (
        <p className="text-xs text-virla-muted">Faltam: {missing.join(', ')}</p>
      )}
    </div>
  )
}
