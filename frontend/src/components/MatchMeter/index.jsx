import Check from '@mui/icons-material/Check'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import '../../design-system/match.css'

const LEVEL = {
  EXCELENTE: { label: 'Excelente match', tone: 'ok' },
  ALTA: { label: 'Alta compatibilidade', tone: 'brand' },
  BOA: { label: 'Boa compatibilidade', tone: 'calm' },
  POSSIVEL: { label: 'Compatibilidade possível', tone: 'muted' },
}

/** Compatibilidade da solicitação escolhida: número, régua e os motivos. */
export default function MatchMeter({ match }) {
  if (!match || !Number.isFinite(Number(match.score))) return null
  const score = Math.max(0, Math.min(100, Math.round(Number(match.score))))
  const level = LEVEL[match.level] ?? { label: 'Compatibilidade calculada', tone: 'muted' }
  const reasons = Array.isArray(match.reasons) ? match.reasons.slice(0, 4) : []
  const attention = Array.isArray(match.attention) ? match.attention[0] : null
  const isFallback = match.isFallback === true

  return (
    <section className={`vfd-match tone-${level.tone}`} aria-label={`Compatibilidade de ${score}%`}>
      <div className="vfd-match-head">
        <p className="vfd-match-score"><strong>{score}%</strong> compatível</p>
        <span className="vfd-match-level">{isFallback ? 'Alternativa por baixa oferta' : level.label}</span>
      </div>
      <div className="vfd-meter" aria-hidden="true"><span style={{ width: `${score}%` }} /></div>
      {reasons.length > 0 && (
        <ul className="vfd-reasons">
          {reasons.map((reason) => (
            <li key={reason.code}>
              <Check aria-hidden className="vfd-reason-icon" />
              <span>{reason.label}</span>
              <b>+{reason.points}</b>
            </li>
          ))}
        </ul>
      )}
      {attention && (
        <p className="vfd-attention"><InfoOutlined aria-hidden />{attention}</p>
      )}
      {isFallback && (
        <p className="vfd-attention">Exibida porque há poucas opções com pelo menos 60% de compatibilidade.</p>
      )}
    </section>
  )
}

