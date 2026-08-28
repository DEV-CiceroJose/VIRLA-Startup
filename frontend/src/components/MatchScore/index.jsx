import AutoAwesome from '@mui/icons-material/AutoAwesome'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { Badge } from '../ui'

const LEVEL_LABEL = {
  EXCELENTE: 'Excelente match',
  ALTA: 'Alta compatibilidade',
  BOA: 'Boa compatibilidade',
  POSSIVEL: 'Compatibilidade possível',
}

const LEVEL_TONE = {
  EXCELENTE: 'green',
  ALTA: 'violet',
  BOA: 'blue',
  POSSIVEL: 'gray',
}

export default function MatchScore({ match, compact = false }) {
  if (!match || !Number.isFinite(Number(match.score))) return null
  const score = Math.max(0, Math.min(100, Number(match.score)))
  const reasons = Array.isArray(match.reasons) ? match.reasons : []
  const attention = Array.isArray(match.attention) ? match.attention : []
  const isFallback = match.isFallback === true

  if (compact) {
    return (
      <Badge tone={LEVEL_TONE[match.level] ?? 'gray'} icon={AutoAwesome}>
        {score}% compatível{isFallback ? ' · alternativa' : ''}
      </Badge>
    )
  }

  return (
    <section aria-label={`Compatibilidade de ${score}%`} className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-virla-roxo">
          <AutoAwesome sx={{ fontSize: 18 }} />
          <span>{score}% compatível</span>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {isFallback && <Badge tone="amber">Alternativa por baixa oferta</Badge>}
          <Badge tone={LEVEL_TONE[match.level] ?? 'gray'}>
            {LEVEL_LABEL[match.level] ?? 'Compatibilidade calculada'}
          </Badge>
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="space-y-1 text-xs text-virla-texto/75">
          {reasons.slice(0, 4).map((reason) => (
            <li key={reason.code} className="flex justify-between gap-3">
              <span>{reason.label}</span>
              <strong className="text-virla-roxo">+{reason.points}</strong>
            </li>
          ))}
        </ul>
      )}
      {attention[0] && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-800">
          <InfoOutlined sx={{ fontSize: 15 }} className="mt-0.5 shrink-0" />
          {attention[0]}
        </p>
      )}
      {isFallback && (
        <p className="text-[11px] font-semibold text-amber-800">
          Exibida porque há poucas solicitações com pelo menos 60% de compatibilidade.
        </p>
      )}
      <p className="text-[10px] text-virla-muted">Sugestão baseada no perfil e na solicitação. Confirme os detalhes antes de contratar.</p>
    </section>
  )
}
