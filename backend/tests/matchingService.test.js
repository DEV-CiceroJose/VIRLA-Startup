import test from 'node:test'
import assert from 'node:assert/strict'
import {
  careTypesToSpecialties,
  rankCaregiversForSolicitacao,
  selectSolicitacoesForCaregiver,
  scoreCaregiverForSolicitacao,
} from '../src/services/matchingService.js'

const solicitacao = {
  cidade: 'Fortaleza',
  estado: 'CE',
  tipoCuidado: ['Alzheimer', 'Mobilidade reduzida'],
  valorHora: 40,
  turno: 'MANHA',
  frequencia: 'SEMANAL',
}

const completeCaregiver = {
  id: 'caregiver-completo',
  name: 'Ana Cuidadora',
  city: 'Fortaleza',
  state: 'CE',
  hourlyRate: 40,
  specialties: ['ALZHEIMER_DEMENCIA', 'MOBILIDADE_REDUZIDA'],
  availableShifts: ['MANHA', 'TARDE'],
  serviceFrequencies: ['DIARIA', 'SEMANAL'],
  council: 'COREN',
  registerNumber: '123456-CE',
  description: 'Profissional com experiência comprovada em acompanhamento domiciliar, rotinas de medicação e mobilidade assistida.',
  approach: 'Cuidado humanizado e comunicação diária com a família.',
  profileImage: 'https://example.com/profile.png',
}

test('normaliza tipos de cuidado da solicitação para especialidades do perfil', () => {
  assert.deepEqual(
    careTypesToSpecialties(['Pós-operatório', 'Hipertensão', 'Pernoite']),
    ['POS_CIRURGICO', 'HIPERTENSAO', 'PERNOITE'],
  )
})

test('match completo chega a 100 e explica os critérios', () => {
  const match = scoreCaregiverForSolicitacao(completeCaregiver, solicitacao)
  assert.equal(match.score, 100)
  assert.equal(match.level, 'EXCELENTE')
  assert.ok(match.reasons.some((reason) => reason.code === 'SPECIALTY_MATCH' && reason.points === 35))
  assert.ok(match.reasons.some((reason) => reason.code === 'SAME_CITY'))
  assert.ok(match.reasons.some((reason) => reason.code === 'AVAILABILITY_MATCH' && reason.points === 10))
  assert.equal(match.version, 'virla-match-v1')
})

test('localização e orçamento diferentes reduzem a pontuação sem excluir o cuidador', () => {
  const match = scoreCaregiverForSolicitacao({
    ...completeCaregiver,
    city: 'Recife',
    state: 'PE',
    hourlyRate: 80,
    specialties: ['ALZHEIMER_DEMENCIA'],
  }, solicitacao)

  assert.ok(match.score > 0)
  assert.ok(match.score < 70)
  assert.ok(match.attention.some((message) => message.includes('Localização')))
  assert.ok(match.attention.some((message) => message.includes('acima')))
})

test('ranking coloca o cuidador mais compatível primeiro', () => {
  const ranked = rankCaregiversForSolicitacao([
    { ...completeCaregiver, id: 'distante', city: 'Recife', state: 'PE', hourlyRate: 80 },
    completeCaregiver,
  ], solicitacao)

  assert.equal(ranked[0].caregiver.id, completeCaregiver.id)
  assert.ok(ranked[0].match.score > ranked[1].match.score)
})

test('pontuação ignora atributos pessoais que não fazem parte do cuidado', () => {
  const base = scoreCaregiverForSolicitacao(completeCaregiver, solicitacao)
  const changed = scoreCaregiverForSolicitacao({
    ...completeCaregiver,
    birthDate: '1950-01-01',
    cpf: '00000000000',
    email: 'outra@example.com',
  }, solicitacao)
  assert.deepEqual(changed, base)
})

test('solicitação de cuidado geral não perde os pontos de especialidade', () => {
  const match = scoreCaregiverForSolicitacao(completeCaregiver, {
    ...solicitacao,
    tipoCuidado: [],
  })

  assert.equal(match.score, 100)
  assert.ok(match.reasons.some((reason) => reason.code === 'GENERAL_CARE' && reason.points === 35))
})

test('oculta matches abaixo de 60 quando já existem cinco boas oportunidades', () => {
  const scored = [90, 82, 75, 68, 60, 55, 40].map((score, index) => ({
    id: `solicitacao-${index}`,
    viewedByIds: [],
    match: { score },
  }))

  const result = selectSolicitacoesForCaregiver(scored, 'caregiver-completo')

  assert.deepEqual(result.solicitacoes.map((item) => item.match.score), [90, 82, 75, 68, 60])
  assert.equal(result.policy.fallbackCount, 0)
  assert.equal(result.policy.hiddenCount, 2)
})

test('completa até cinco oportunidades com as melhores alternativas abaixo de 60', () => {
  const scored = [88, 70, 58, 45, 30, 20, 10].map((score, index) => ({
    id: `solicitacao-${index}`,
    viewedByIds: [],
    match: { score },
  }))

  const result = selectSolicitacoesForCaregiver(scored, 'caregiver-completo')

  assert.deepEqual(result.solicitacoes.map((item) => item.match.score), [88, 70, 58, 45, 30])
  assert.deepEqual(
    result.solicitacoes.filter((item) => item.match.isFallback).map((item) => item.match.score),
    [58, 45, 30],
  )
  assert.equal(result.policy.hiddenCount, 2)
})

test('mantém acessível uma solicitação já visualizada mesmo abaixo do limiar', () => {
  const caregiverId = 'caregiver-completo'
  const scored = [90, 85, 80, 75, 70].map((score, index) => ({
    id: `preferida-${index}`,
    viewedByIds: [],
    match: { score },
  }))
  scored.push({ id: 'ja-visualizada', viewedByIds: [caregiverId], match: { score: 20 } })

  const result = selectSolicitacoesForCaregiver(scored, caregiverId)
  const retained = result.solicitacoes.find((item) => item.id === 'ja-visualizada')

  assert.ok(retained)
  assert.equal(retained.match.isFallback, undefined)
})
