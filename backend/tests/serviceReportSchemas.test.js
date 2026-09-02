import test from 'node:test'
import assert from 'node:assert/strict'
import { createServiceReportBodySchema, signServiceReportBodySchema } from '../src/schemas/serviceReportSchemas.js'

test('relatório válido exige serviço, horários e atividades, sem aceitar valor do cliente', () => {
  const result = createServiceReportBodySchema.safeParse({
    solicitacaoId: 'solicitacao1234567890',
    serviceDate: '2026-08-23',
    startedAt: '08:30',
    endedAt: '16:30',
    activities: 'Acompanhamento diário, alimentação e medicação conforme orientação.',
  })
  assert.equal(result.success, true)
  assert.equal(result.data.observations, '')
  assert.equal(result.data.incidents, '')
})

test('relatório rejeita horários e atividades insuficientes', () => {
  const result = createServiceReportBodySchema.safeParse({
    solicitacaoId: 'solicitacao1234567890',
    serviceDate: '23/08/2026',
    startedAt: '8h',
    endedAt: '16:00',
    activities: 'Pouco texto',
  })
  assert.equal(result.success, false)
})

test('relatório rejeita data futura e término anterior ao início', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const result = createServiceReportBodySchema.safeParse({
    solicitacaoId: 'solicitacao-123',
    serviceDate: future,
    startedAt: '18:00',
    endedAt: '17:00',
    activities: 'Atividades de cuidado realizadas durante o atendimento.',
  })

  assert.equal(result.success, false)
  assert.ok(result.error.issues.some((issue) => issue.path[0] === 'serviceDate'))
  assert.ok(result.error.issues.some((issue) => issue.path[0] === 'endedAt'))
})

test('assinatura exige os dois aceites e nome completo digitado', () => {
  assert.equal(signServiceReportBodySchema.safeParse({ accepted: true, declaration: true, typedName: 'Maria da Silva' }).success, true)
  assert.equal(signServiceReportBodySchema.safeParse({ accepted: false, declaration: true, typedName: 'Maria da Silva' }).success, false)
  assert.equal(signServiceReportBodySchema.safeParse({ accepted: true, declaration: false, typedName: 'Maria da Silva' }).success, false)
})
