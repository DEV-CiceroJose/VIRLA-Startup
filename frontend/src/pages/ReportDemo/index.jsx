import { useEffect, useMemo, useRef, useState } from 'react'
import Assignment from '@mui/icons-material/Assignment'
import CheckCircle from '@mui/icons-material/CheckCircle'
import FamilyRestroom from '@mui/icons-material/FamilyRestroom'
import HealthAndSafety from '@mui/icons-material/HealthAndSafety'
import RestartAlt from '@mui/icons-material/RestartAlt'
import ServiceReportModal from '../../components/ServiceReportModal'
import ServiceReportReviewModal from '../../components/ServiceReportReviewModal'
import { Alert, Badge, Button } from '../../components/ui'
import { calculateChargeTotalCents, formatCentsBRL } from '../../utils/paymentFees'

const solicitacao = {
  id: 'demo-relatorio-virla',
  titulo: 'Acompanhamento domiciliar — demonstração',
  status: 'EM_ANDAMENTO',
}

const STATUS_LABEL = {
  PENDING_SIGNATURE: 'Aguardando familiar',
  SIGNED: 'Pagamento liberado',
  PAID: 'Pagamento confirmado',
}

function demoHash(report) {
  const source = `${report.id}:${report.serviceDate}:${report.startedAt}:${report.endedAt}:${report.activities}:${report.totalAmount}`
  let seed = 0
  for (const char of source) seed = (seed * 31 + char.charCodeAt(0)) >>> 0
  return Array.from({ length: 64 }, (_, index) => ((seed + index * 13) % 16).toString(16)).join('')
}

export default function ReportDemo() {
  const [role, setRole] = useState('CUIDADOR')
  const [report, setReport] = useState(null)
  const [modal, setModal] = useState(null)
  const reportRef = useRef(report)
  useEffect(() => {
    reportRef.current = report
  }, [report])

  const demoApi = useMemo(() => ({
    async get(path) {
      if (path.startsWith('/service-reports/solicitacao/')) {
        return { data: { report: reportRef.current } }
      }
      throw new Error(`Rota de demonstração não suportada: ${path}`)
    },
    async post(path, body) {
      if (path === '/service-reports') {
        if (reportRef.current) {
          const error = new Error('Já existe um relatório nesta demonstração.')
          error.response = { data: { msg: error.message } }
          throw error
        }
        const fees = calculateChargeTotalCents(body.baseAmount)
        const created = {
          id: solicitacao.id,
          solicitacaoId: solicitacao.id,
          caregiverId: 'cuidador-demo',
          familiarId: 'familiar-demo',
          ...body,
          ...fees,
          baseAmount: fees.baseCents,
          totalAmount: fees.totalCents,
          status: 'PENDING_SIGNATURE',
          signature: null,
          reportHash: null,
        }
        reportRef.current = created
        setReport(created)
        return { data: { report: created } }
      }
      if (path.endsWith('/sign')) {
        const current = reportRef.current
        if (!current || !body.accepted || !body.declaration || body.typedName.trim().toLocaleLowerCase('pt-BR') !== 'maria da silva') {
          const error = new Error('Digite Maria da Silva, o nome do familiar desta demonstração.')
          error.response = { data: { msg: error.message } }
          throw error
        }
        const signed = {
          ...current,
          status: 'SIGNED',
          reportHash: demoHash(current),
          signature: {
            signedByUserId: 'familiar-demo',
            signedByName: 'Maria da Silva',
            typedName: body.typedName,
            signedAt: new Date().toISOString(),
          },
        }
        reportRef.current = signed
        setReport(signed)
        return { data: { report: signed } }
      }
      throw new Error(`Rota de demonstração não suportada: ${path}`)
    },
  }), [])

  function resetDemo() {
    reportRef.current = null
    setReport(null)
    setRole('CUIDADOR')
    setModal(null)
  }

  async function simulatePayment(current) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const paid = { ...current, status: 'PAID', paidAt: new Date().toISOString() }
    reportRef.current = paid
    setReport(paid)
    return paid
  }

  const step = !report ? 1 : report.status === 'PENDING_SIGNATURE' ? 2 : report.status === 'SIGNED' ? 3 : 4

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 px-4 py-8 text-virla-texto">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl bg-virla-roxo p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="amber">Demonstração local</Badge>
              <h1 className="mt-3 text-3xl font-display font-black">Relatório diário e assinatura</h1>
              <p className="mt-2 max-w-2xl text-violet-100">Teste o caminho completo sem conta, Firebase ou cobrança real.</p>
            </div>
            <Button variant="secondary" icon={RestartAlt} onClick={resetDemo}>Recomeçar</Button>
          </div>
        </header>

        <Alert tone="info">Esta página existe apenas no modo de desenvolvimento. O pagamento final é simulado e não acessa a Stripe.</Alert>

        <section className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow-sm" aria-label="Escolher perfil da demonstração">
          <button type="button" aria-label="Perfil cuidador — Carlos Oliveira" aria-pressed={role === 'CUIDADOR'} onClick={() => setRole('CUIDADOR')} className={`rounded-xl p-4 text-left transition ${role === 'CUIDADOR' ? 'bg-virla-roxo text-white' : 'hover:bg-violet-50'}`}>
            <HealthAndSafety className="mb-1" />
            <strong className="block">Cuidador</strong>
            <span className="text-xs opacity-80">Carlos Oliveira</span>
          </button>
          <button type="button" aria-label="Perfil familiar — Maria da Silva" aria-pressed={role === 'FAMILIAR'} onClick={() => setRole('FAMILIAR')} className={`rounded-xl p-4 text-left transition ${role === 'FAMILIAR' ? 'bg-virla-roxo text-white' : 'hover:bg-violet-50'}`}>
            <FamilyRestroom className="mb-1" />
            <strong className="block">Familiar</strong>
            <span className="text-xs opacity-80">Maria da Silva</span>
          </button>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-virla-muted">Etapa {step} de 4</p>
              <h2 className="text-xl font-bold">{solicitacao.titulo}</h2>
            </div>
            {report && <Badge tone={report.status === 'PAID' ? 'green' : report.status === 'PENDING_SIGNATURE' ? 'amber' : 'blue'}>{STATUS_LABEL[report.status]}</Badge>}
          </div>

          <div className="mt-5 rounded-xl border border-virla-roxo/10 p-4">
            {!report && <p className="text-sm text-virla-muted">Nenhum relatório enviado. O pagamento está bloqueado.</p>}
            {report && (
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p><span className="block text-xs text-virla-muted">Data</span><strong>{report.serviceDate}</strong></p>
                <p><span className="block text-xs text-virla-muted">Horário</span><strong>{report.startedAt}–{report.endedAt}</strong></p>
                <p><span className="block text-xs text-virla-muted">Total</span><strong>{formatCentsBRL(report.totalAmount)}</strong></p>
              </div>
            )}
          </div>

          <div className="mt-5">
            {role === 'CUIDADOR' && !report && <Button icon={Assignment} onClick={() => setModal('create')}>Preencher relatório do dia</Button>}
            {role === 'CUIDADOR' && report && <Alert tone="success">Relatório enviado. Agora alterne para Familiar para revisar e assinar.</Alert>}
            {role === 'FAMILIAR' && <Button icon={Assignment} onClick={() => setModal('review')}>{report ? 'Revisar relatório' : 'Ver pagamento bloqueado'}</Button>}
            {report?.status === 'PAID' && <div className="mt-4 flex items-center gap-2 font-bold text-green-700"><CheckCircle /> Fluxo concluído com pagamento simulado.</div>}
          </div>
        </section>
      </div>

      {modal === 'create' && <ServiceReportModal solicitacao={solicitacao} apiClient={demoApi} onClose={() => setModal(null)} onCreated={setReport} />}
      {modal === 'review' && <ServiceReportReviewModal solicitacao={solicitacao} apiClient={demoApi} onDemoPayment={simulatePayment} onClose={() => setModal(null)} onUpdated={setReport} />}
    </main>
  )
}
