import { useState } from 'react'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import LocationOn from '@mui/icons-material/LocationOn'
import Person from '@mui/icons-material/Person'
import Payments from '@mui/icons-material/Payments'
import RestartAlt from '@mui/icons-material/RestartAlt'
import MatchScore from '../../components/MatchScore'
import { Alert, Badge, Button, Field } from '../../components/ui'
import { formatHourly } from '../../utils/formatters'

const REQUESTS = [
  { id: 'alz', title: 'Acompanhamento para Alzheimer', city: 'Fortaleza', state: 'CE', budget: 40 },
  { id: 'pos', title: 'Cuidados pós-operatórios', city: 'Recife', state: 'PE', budget: 50 },
]

const CAREGIVERS = [
  { id: 'ana', name: 'Ana Oliveira', city: 'Fortaleza', state: 'CE', hourlyRate: 40, specialties: ['Alzheimer/Demência', 'Mobilidade reduzida'] },
  { id: 'bruno', name: 'Bruno Santos', city: 'Caucaia', state: 'CE', hourlyRate: 44, specialties: ['Idosos', 'Alzheimer/Demência'] },
  { id: 'carla', name: 'Carla Souza', city: 'Recife', state: 'PE', hourlyRate: 48, specialties: ['Pós-cirúrgico', 'Reabilitação'] },
]

const MATCHES = {
  alz: {
    ana: { score: 100, level: 'EXCELENTE', reasons: [{ code: 'SPECIALTY_MATCH', label: 'Especialidades cobrem todas as necessidades', points: 35 }, { code: 'SAME_CITY', label: 'Atende na mesma cidade', points: 25 }, { code: 'PRICE_FIT', label: 'Valor dentro do orçamento', points: 20 }, { code: 'AVAILABILITY_MATCH', label: 'Turno e frequência compatíveis', points: 10 }], attention: [] },
    bruno: { score: 72, level: 'ALTA', reasons: [{ code: 'SPECIALTY_MATCH', label: 'Compatível com 1 de 2 necessidades', points: 20 }, { code: 'SAME_STATE', label: 'Atende no mesmo estado', points: 15 }, { code: 'PRICE_FIT', label: 'Valor até 10% acima do orçamento', points: 15 }], attention: ['Confirme o deslocamento até Fortaleza e a experiência com mobilidade reduzida.'] },
    carla: { score: 10, level: 'POSSIVEL', reasons: [{ code: 'PROFILE_QUALITY', label: 'Perfil profissional bem preenchido', points: 10 }], attention: ['Localização e especialidades diferentes das necessidades informadas.'] },
  },
  pos: {
    ana: { score: 30, level: 'POSSIVEL', reasons: [{ code: 'PRICE_FIT', label: 'Valor dentro do orçamento', points: 20 }, { code: 'PROFILE_QUALITY', label: 'Perfil profissional bem preenchido', points: 10 }], attention: ['Pós-cirúrgico não consta nas especialidades do perfil.'] },
    bruno: { score: 30, level: 'POSSIVEL', reasons: [{ code: 'PRICE_FIT', label: 'Valor dentro do orçamento', points: 20 }, { code: 'PROFILE_QUALITY', label: 'Perfil profissional bem preenchido', points: 10 }], attention: ['Localização e especialidade não correspondem à solicitação.'] },
    carla: { score: 100, level: 'EXCELENTE', reasons: [{ code: 'SPECIALTY_MATCH', label: 'Especialidades cobrem todas as necessidades', points: 35 }, { code: 'SAME_CITY', label: 'Atende na mesma cidade', points: 25 }, { code: 'PRICE_FIT', label: 'Valor dentro do orçamento', points: 20 }, { code: 'AVAILABILITY_MATCH', label: 'Turno e frequência compatíveis', points: 10 }], attention: [] },
  },
}

const CAREGIVER_SUPPLY_SCENARIOS = {
  abundant: {
    label: 'Muitas solicitações disponíveis',
    description: 'Há 6 solicitações com pelo menos 60%. As 2 opções abaixo do limiar ficam ocultas.',
    hiddenCount: 2,
    requests: [
      { id: 'a-1', title: 'Acompanhamento matinal', score: 91, level: 'EXCELENTE' },
      { id: 'a-2', title: 'Cuidado semanal', score: 84, level: 'ALTA' },
      { id: 'a-3', title: 'Apoio à mobilidade', score: 78, level: 'ALTA' },
      { id: 'a-4', title: 'Acompanhamento domiciliar', score: 72, level: 'ALTA' },
      { id: 'a-5', title: 'Cuidado noturno', score: 66, level: 'BOA' },
      { id: 'a-6', title: 'Apoio diário', score: 60, level: 'BOA' },
    ],
  },
  scarce: {
    label: 'Poucas solicitações compatíveis',
    description: 'Há apenas 2 solicitações com pelo menos 60%. A lista é completada com as 3 melhores alternativas.',
    hiddenCount: 2,
    requests: [
      { id: 's-1', title: 'Acompanhamento para Alzheimer', score: 88, level: 'EXCELENTE' },
      { id: 's-2', title: 'Cuidados semanais', score: 70, level: 'ALTA' },
      { id: 's-3', title: 'Acompanhamento em outra cidade', score: 58, level: 'BOA', isFallback: true },
      { id: 's-4', title: 'Turno diferente do perfil', score: 45, level: 'POSSIVEL', isFallback: true },
      { id: 's-5', title: 'Necessidades parcialmente compatíveis', score: 30, level: 'POSSIVEL', isFallback: true },
    ],
  },
}

export default function MatchDemo() {
  const [requestId, setRequestId] = useState('alz')
  const [supplyScenarioId, setSupplyScenarioId] = useState('abundant')
  const request = REQUESTS.find((item) => item.id === requestId)
  const supplyScenario = CAREGIVER_SUPPLY_SCENARIOS[supplyScenarioId]
  const ranked = CAREGIVERS
    .map((caregiver) => ({ ...caregiver, match: MATCHES[requestId][caregiver.id] }))
    .sort((a, b) => b.match.score - a.match.score)

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-4 py-8 text-virla-texto">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-virla-roxo p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="amber">Demonstração local</Badge>
              <h1 className="mt-3 flex items-center gap-2 text-3xl font-display font-black"><AutoAwesome /> Match inteligente</h1>
              <p className="mt-2 max-w-2xl text-violet-100">Compare recomendações explicáveis usando necessidades, localização, orçamento e perfil profissional.</p>
            </div>
            <Button variant="secondary" icon={RestartAlt} onClick={() => {
              setRequestId('alz')
              setSupplyScenarioId('abundant')
            }}>Recomeçar</Button>
          </div>
        </header>

        <Alert tone="info">A pontuação ajuda na triagem, mas não garante contratação, disponibilidade ou qualidade do serviço. A decisão continua sendo da família.</Alert>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <Field label="Solicitação usada no match" as="select" value={requestId} onChange={(event) => setRequestId(event.target.value)}>
            {REQUESTS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </Field>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-virla-muted">
            <span className="inline-flex items-center gap-1"><LocationOn sx={{ fontSize: 17 }} />{request.city} - {request.state}</span>
            <span className="inline-flex items-center gap-1"><Payments sx={{ fontSize: 17 }} />Orçamento {formatHourly(request.budget)}</span>
          </div>
        </section>

        <section aria-label="Cuidadores recomendados" className="grid gap-4 lg:grid-cols-3">
          {ranked.map((caregiver, index) => (
            <article key={caregiver.id} className="flex flex-col gap-4 rounded-2xl border border-virla-roxo/10 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-virla-roxo"><Person sx={{ fontSize: 30 }} /></div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-virla-muted">{index + 1}ª recomendação</p>
                  <h2 className="font-bold text-lg">{caregiver.name}</h2>
                  <p className="text-xs text-virla-muted">{caregiver.city} - {caregiver.state} · {formatHourly(caregiver.hourlyRate)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {caregiver.specialties.map((item) => <Badge key={item} tone="roxo">{item}</Badge>)}
              </div>
              <MatchScore match={caregiver.match} />
            </article>
          ))}
        </section>

        <section aria-label="Regra de visibilidade para o cuidador" className="rounded-2xl border border-virla-roxo/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <Badge tone="violet">Visão do cuidador</Badge>
              <h2 className="mt-3 text-2xl font-display font-black text-virla-roxo">Regra dos 60%</h2>
              <p className="mt-2 text-sm text-virla-muted">Matches baixos só aparecem quando faltam boas oportunidades para completar uma lista útil.</p>
              <div className="mt-4">
                <Field
                  label="Cenário de oferta para o cuidador"
                  as="select"
                  value={supplyScenarioId}
                  onChange={(event) => setSupplyScenarioId(event.target.value)}
                >
                  {Object.entries(CAREGIVER_SUPPLY_SCENARIOS).map(([value, scenario]) => (
                    <option key={value} value={value}>{scenario.label}</option>
                  ))}
                </Field>
              </div>
              <Alert tone={supplyScenarioId === 'scarce' ? 'warning' : 'info'} className="mt-4">
                {supplyScenario.description}
              </Alert>
              <p className="mt-3 text-xs text-virla-muted">{supplyScenario.hiddenCount} solicitações de menor compatibilidade continuam ocultas.</p>
            </div>

            <div className="space-y-2" aria-label="Solicitações mostradas ao cuidador">
              {supplyScenario.requests.map((item, index) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/40 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-virla-muted">{index + 1}ª oportunidade</p>
                    <p className="text-sm font-bold text-virla-texto">{item.title}</p>
                  </div>
                  <MatchScore match={item} compact />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
