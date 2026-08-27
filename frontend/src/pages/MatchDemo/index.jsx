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

export default function MatchDemo() {
  const [requestId, setRequestId] = useState('alz')
  const request = REQUESTS.find((item) => item.id === requestId)
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
            <Button variant="secondary" icon={RestartAlt} onClick={() => setRequestId('alz')}>Recomeçar</Button>
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
      </div>
    </main>
  )
}
