const CUIDADOR_CHECKS = [
  { label: 'Foto de perfil', test: (u) => Boolean(u.profileImage) },
  { label: 'Bio', test: (u) => Boolean(u.bio?.trim()) },
  { label: 'Valor por hora', test: (u) => u.hourlyRate !== '' && u.hourlyRate != null },
  {
    label: 'CEP ou cidade/estado',
    test: (u) => Boolean(u.zipCode?.trim()) || Boolean(u.city?.trim() && u.state?.trim()),
  },
  { label: 'Conselho e registro profissional', test: (u) => Boolean(u.council && u.registerNumber?.trim()) },
  { label: 'Especialidades', test: (u) => Array.isArray(u.specialties) && u.specialties.length > 0 },
  { label: 'Descrição', test: (u) => Boolean(u.description?.trim()) },
]

const FAMILIAR_CHECKS = [
  { label: 'Foto de perfil', test: (u) => Boolean(u.profileImage) },
  { label: 'Bio', test: (u) => Boolean(u.bio?.trim()) },
  {
    label: 'CEP ou cidade/estado',
    test: (u) => Boolean(u.zipCode?.trim()) || Boolean(u.city?.trim() && u.state?.trim()),
  },
]

/** Percentual de conclusão do perfil + lista dos itens que faltam (labels). */
export function computeCompleteness(userData, role) {
  const checks = role === 'FAMILIAR' ? FAMILIAR_CHECKS : CUIDADOR_CHECKS
  const missing = checks.filter((c) => !c.test(userData))
  const percent = Math.round(((checks.length - missing.length) / checks.length) * 100)
  return { percent, missing: missing.map((c) => c.label) }
}

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
