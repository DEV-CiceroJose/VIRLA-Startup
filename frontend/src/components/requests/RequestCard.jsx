import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import RepeatOutlined from '@mui/icons-material/RepeatOutlined'
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined'
import { turnoLabel, frequenciaLabel, paymentRecurrenceLabel } from '../../constants/solicitacaoOptions'
import { formatHourly, formatDateOnly } from '../../utils/formatters'
import '../../design-system/requests.css'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const STATUS = {
  ABERTA: { label: 'Aberta', tone: 'brand' },
  VISUALIZADA: { label: 'Visualizada', tone: 'calm' },
  EM_ANDAMENTO: { label: 'Em andamento', tone: 'wait' },
  CONCLUIDA: { label: 'Concluída', tone: 'ok' },
  CANCELADA: { label: 'Cancelada', tone: 'risk' },
}

const URGENCIA = { BAIXA: 'Urgência baixa', MEDIA: 'Urgência média', ALTA: 'Urgência alta' }

function datePill(iso) {
  const [y, m, d] = String(iso || '').split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return { day: String(d).padStart(2, '0'), month: MONTHS[m - 1], year: y }
}

/**
 * Cartão de solicitação no idioma do painel: pílula da data de início à
 * esquerda, título e status, descrição curta, chips de turno/frequência/valor
 * e área livre (children) para match, avisos e ações.
 */
export default function RequestCard({ solicitacao: s, place, extraMeta, children, actions, highlight = false }) {
  const status = STATUS[s.status] ?? { label: s.status, tone: 'muted' }
  const date = datePill(s.dataInicio)
  const tags = Array.isArray(s.tipoCuidado) ? s.tipoCuidado : []

  return (
    <article className={`vs-card${highlight ? ' is-highlight' : ''}`} aria-labelledby={`vs-title-${s.id}`}>
      <div className="vs-card-main">
        {date ? (
          <div className="vs-date" aria-label={`Início em ${date.day} de ${date.month} de ${date.year}`}>
            <strong>{date.day}</strong>
            <span>{date.month}</span>
          </div>
        ) : (
          <div className="vs-date is-empty" aria-hidden="true"><span>sem data</span></div>
        )}

        <div className="vs-body">
          <div className="vs-head">
            <h3 id={`vs-title-${s.id}`}>{s.titulo}</h3>
            <span className={`vs-status tone-${status.tone}`}>{status.label}</span>
          </div>
          {s.descricao && <p className="vs-desc">{s.descricao}</p>}

          <ul className="vs-meta" aria-label="Detalhes">
            {s.valorHora != null && <li className="is-strong"><PaymentsOutlined aria-hidden />{formatHourly(s.valorHora)}</li>}
            {s.turno && <li><ScheduleOutlined aria-hidden />{turnoLabel(s.turno)}</li>}
            {s.frequencia && <li><RepeatOutlined aria-hidden />{frequenciaLabel(s.frequencia)}</li>}
            {place && <li><LocationOnOutlined aria-hidden />{place}</li>}
            {s.paymentRecurrence && <li>Pagamento {paymentRecurrenceLabel(s.paymentRecurrence).toLowerCase()}</li>}
            {s.urgencia && <li className={`vs-urg u-${s.urgencia}`}>{URGENCIA[s.urgencia] ?? s.urgencia}</li>}
          </ul>

          {tags.length > 0 && (
            <ul className="vs-tags" aria-label="Tipo de cuidado">
              {tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          )}

          <p className="vs-foot">
            {s.dataInicio && <span>Início {formatDateOnly(s.dataInicio)}</span>}
            {s.createdAt && <span>Publicada em {new Date(s.createdAt).toLocaleDateString('pt-BR')}</span>}
            {extraMeta}
          </p>
        </div>
      </div>

      {children}

      {actions && <div className="vs-actions">{actions}</div>}
    </article>
  )
}
