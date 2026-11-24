import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Inbox from '@mui/icons-material/InboxOutlined'
import Visibility from '@mui/icons-material/Visibility'
import Chat from '@mui/icons-material/Chat'
import AssignmentTurnedIn from '@mui/icons-material/AssignmentTurnedIn'
import Assignment from '@mui/icons-material/Assignment'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'
import HourglassTopOutlined from '@mui/icons-material/HourglassTopOutlined'
import api from '../../services/api'
import { PageLoader } from '../../components/Spinner'
import { Button, Alert } from '../../components/ui'
import AnimatedTabs from '../../components/ui/AnimatedTabs'
import RequestCard from '../../components/requests/RequestCard'
import MatchMeter from '../../components/MatchMeter'
import { formatDateOnly } from '../../utils/formatters'
import { calculatePaymentDueDate, paymentCountdownLabel, todayDateOnly } from '../../utils/paymentSchedule'
import ServiceReportModal from '../../components/ServiceReportModal'
import StripeConnectCard from '../../components/StripeConnectCard'
import '../../design-system/requests.css'

function SolicitacaoCard({ solicitacao, mode, onVisualizar, onAssumir, onConversar, onReport, busy }) {
  const local = [solicitacao.familiar?.city, solicitacao.familiar?.state].filter(Boolean).join(' - ')
  const showFamiliar = mode === 'visualizada' || mode === 'andamento'
  const nextPaymentDate = mode === 'andamento' && solicitacao.paymentRecurrence
    ? calculatePaymentDueDate({
        contractStartDate: solicitacao.dataInicio,
        serviceDate: todayDateOnly(),
        paymentRecurrence: solicitacao.paymentRecurrence,
      })
    : null

  return (
    <RequestCard
      solicitacao={solicitacao}
      place={local}
      highlight={mode === 'andamento'}
      extraMeta={solicitacao.familiar?.name && showFamiliar && (
        <span className="vs-foot-strong">Família: {solicitacao.familiar.name}</span>
      )}
      actions={(
        <>
          {mode === 'disponivel' && (
            <Button size="sm" icon={Visibility} loading={busy} onClick={() => onVisualizar(solicitacao)}>
              Ver detalhes
            </Button>
          )}
          {mode === 'visualizada' && (
            <>
              <Button size="sm" icon={AssignmentTurnedIn} loading={busy} onClick={() => onAssumir(solicitacao)}>
                Assumir solicitação
              </Button>
              <Button size="sm" variant="secondary" icon={Chat} onClick={() => onConversar(solicitacao.familiarId)}>
                Conversar com a família
              </Button>
            </>
          )}
          {mode === 'andamento' && (
            <>
              <Button size="sm" icon={Assignment} onClick={() => onReport(solicitacao)}>
                Enviar relatório do dia
              </Button>
              <Button size="sm" variant="secondary" icon={Chat} onClick={() => onConversar(solicitacao.familiarId)}>
                Conversar com a família
              </Button>
            </>
          )}
        </>
      )}
    >
      <MatchMeter match={solicitacao.match} />
      {nextPaymentDate && (
        <p className="vs-note">
          Próximo recebimento previsto para {formatDateOnly(nextPaymentDate)} ({paymentCountdownLabel(nextPaymentDate)}), após o familiar assinar o relatório.
        </p>
      )}
    </RequestCard>
  )
}

const TABS = [
  { key: 'disponiveis', label: 'Disponíveis' },
  { key: 'visualizadas', label: 'Visualizadas' },
  { key: 'andamento', label: 'Em andamento' },
]

const EMPTY = {
  disponiveis: ['Nenhuma solicitação disponível', 'Quando uma família publicar uma solicitação compatível, ela aparece aqui.'],
  visualizadas: ['Você ainda não abriu nenhuma', 'Abra uma solicitação em "Disponíveis" para ver os detalhes e decidir se quer assumir.'],
  andamento: ['Nenhuma solicitação em andamento', 'Assuma uma solicitação em "Visualizadas" para acompanhá-la aqui.'],
}

export default function SolicitacoesCuidador() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [solicitacoes, setSolicitacoes] = useState([])
  const [tab, setTab] = useState('disponiveis')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [busyId, setBusyId] = useState(null)
  const [reporting, setReporting] = useState(null)
  const [matchPolicy, setMatchPolicy] = useState(null)
  const [verificationGate, setVerificationGate] = useState(null)

  const meuId = localStorage.getItem('meuId')

  async function loadSolicitacoes() {
    try {
      const res = await api.get('/solicitacoes/disponiveis')
      setSolicitacoes(res.data.solicitacoes ?? [])
      setMatchPolicy(res.data.matchPolicy ?? null)
      setVerificationGate(null)
    } catch (err) {
      if (err?.response?.data?.code === 'VERIFICATION_REQUIRED') {
        setVerificationGate(err.response.data.verificationStatus ?? 'NAO_ENVIADO')
      } else {
        const msg = err?.response?.data?.msg || 'Erro ao carregar solicitações.'
        setMessage({ type: 'error', text: msg })
      }
      setMatchPolicy(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!meuId) {
      navigate('/login')
      return
    }
    loadSolicitacoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuId])

  const { disponiveis, visualizadas, andamento } = useMemo(() => {
    const disp = []
    const vis = []
    const and = []
    for (const s of solicitacoes) {
      if (s.status === 'EM_ANDAMENTO' && s.assignedCaregiverId === meuId) {
        and.push(s)
      } else if (Array.isArray(s.viewedByIds) && s.viewedByIds.includes(meuId)) {
        vis.push(s)
      } else {
        disp.push(s)
      }
    }
    return { disponiveis: disp, visualizadas: vis, andamento: and }
  }, [solicitacoes, meuId])

  const buckets = { disponiveis, visualizadas, andamento }

  async function handleVisualizar(solicitacao) {
    setMessage({ type: '', text: '' })
    try {
      setBusyId(solicitacao.id)
      await api.put(`/solicitacoes/${solicitacao.id}/visualizar`)
      await loadSolicitacoes()
      setTab('visualizadas')
    } catch {
      setMessage({ type: 'error', text: 'Erro ao abrir solicitação.' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleAssumir(solicitacao) {
    setMessage({ type: '', text: '' })
    try {
      setBusyId(solicitacao.id)
      await api.patch(`/solicitacoes/${solicitacao.id}/assumir`)
      await loadSolicitacoes()
      setTab('andamento')
      setMessage({ type: 'success', text: 'Você assumiu esta solicitação. A família foi notificada.' })
    } catch (err) {
      const msg = err?.response?.data?.msg || 'Erro ao assumir solicitação.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setBusyId(null)
    }
  }

  function handleConversar(familiarId) {
    navigate(`/chat/${familiarId}`)
  }

  if (loading) {
    return <PageLoader label="Carregando solicitações…" />
  }

  const lista = buckets[tab]
  const modeForTab = { disponiveis: 'disponivel', visualizadas: 'visualizada', andamento: 'andamento' }
  const [emptyTitle, emptyText] = EMPTY[tab]
  const inReview = verificationGate === 'EM_ANALISE'

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash vs-page">
        <header className="vs-header">
          <div className="vd-greeting">
            <h1>Solicitações</h1>
            <p>Famílias procurando cuidado, ordenadas pela compatibilidade com o seu perfil.</p>
          </div>
        </header>

        {verificationGate ? (
          <section className={`vs-gate${inReview ? ' is-wait' : ''}`} aria-labelledby="vs-gate-title">
            <span className="vs-gate-icon">{inReview ? <HourglassTopOutlined aria-hidden /> : <VerifiedUserOutlined aria-hidden />}</span>
            <div>
              <h2 id="vs-gate-title">{inReview ? 'Seus documentos estão em análise' : 'Falta pouco para receber solicitações'}</h2>
              <p>
                {inReview
                  ? 'Assim que a equipe aprovar sua verificação, as solicitações das famílias aparecem aqui. Avisamos por notificação.'
                  : 'Para a segurança das famílias, só cuidadores com documentos e antecedentes conferidos veem e assumem solicitações.'}
              </p>
              <Link to="/verificacao" className="vs-gate-cta">{inReview ? 'Acompanhar verificação' : 'Fazer minha verificação'}</Link>
            </div>
          </section>
        ) : (
          <>
            <StripeConnectCard />

            {message.text && (
              <Alert tone={message.type === 'success' ? 'success' : 'error'} className="vs-alert">{message.text}</Alert>
            )}

            <div className="vs-toolbar">
              <AnimatedTabs
                label="Filtrar solicitações"
                value={tab}
                onChange={setTab}
                tabs={TABS.map((t) => ({ value: t.key, label: t.label, count: buckets[t.key].length }))}
              />
            </div>

            {tab === 'disponiveis' && matchPolicy?.fallbackCount > 0 && (
              <Alert tone="warning" title="Poucas solicitações com 60% ou mais" className="vs-alert">
                Mostramos também {matchPolicy.fallbackCount} {matchPolicy.fallbackCount === 1 ? 'alternativa' : 'alternativas'} abaixo de 60%, priorizando as mais próximas do seu perfil.
              </Alert>
            )}

            {lista.length === 0 ? (
              <div className="vd-empty vs-empty">
                <Inbox aria-hidden />
                <strong>{emptyTitle}</strong>
                <span>{emptyText}</span>
              </div>
            ) : (
              <div className="vs-list">
                {lista.map((s) => (
                  <SolicitacaoCard
                    key={s.id}
                    solicitacao={s}
                    mode={modeForTab[tab]}
                    onVisualizar={handleVisualizar}
                    onAssumir={handleAssumir}
                    onConversar={handleConversar}
                    onReport={setReporting}
                    busy={busyId === s.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {reporting && (
        <ServiceReportModal
          solicitacao={reporting}
          onClose={() => setReporting(null)}
          onCreated={() => setMessage({ type: 'success', text: 'Relatório enviado. O familiar precisa revisar e assinar antes do pagamento.' })}
        />
      )}
    </div>
  )
}
