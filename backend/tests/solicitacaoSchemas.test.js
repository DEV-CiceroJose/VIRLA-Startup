import test from 'node:test'
import assert from 'node:assert/strict'
import { createSolicitacaoBodySchema } from '../src/schemas/solicitacaoSchemas.js'

const BASE = {
  titulo: 'Preciso de cuidador',
  descricao: 'Descrição com detalhes suficientes.',
  cidade: 'Fortaleza',
  estado: 'ce',
  dataInicio: '2026-08-01',
  valorHora: 45,
  paymentRecurrence: 'SEMANAL',
}

test('happy path: aceita todos os campos e faz upper no estado', () => {
  const r = createSolicitacaoBodySchema.safeParse({
    ...BASE,
    turno: 'MANHA',
    frequencia: 'SEMANAL',
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
  assert.equal(r.data.estado, 'CE')
})

test('rejeita sem cidade', () => {
  const { cidade, ...rest } = BASE
  assert.equal(createSolicitacaoBodySchema.safeParse(rest).success, false)
})

test('rejeita sem estado', () => {
  const { estado, ...rest } = BASE
  assert.equal(createSolicitacaoBodySchema.safeParse(rest).success, false)
})

test('rejeita estado que não tem 2 letras', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, estado: 'CEA' }).success, false)
})

test('rejeita sem dataInicio', () => {
  const { dataInicio, ...rest } = BASE
  assert.equal(createSolicitacaoBodySchema.safeParse(rest).success, false)
})

test('rejeita dataInicio não-parseável', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, dataInicio: 'ontem' }).success, false)
})

test('aceita dataInicio no passado (regra "sem passado" é client)', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, dataInicio: '2000-01-01' }).success, true)
})

test('rejeita valorHora abaixo de 10', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, valorHora: 5 }).success, false)
})

test('rejeita valorHora acima de 500', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, valorHora: 501 }).success, false)
})

test('aceita valorHora como string numérica dentro da faixa', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, valorHora: '45.00' }).success, true)
})

test('rejeita valorHora null/ausente porque define o contrato', () => {
  const { valorHora, ...semValor } = BASE
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, valorHora: null }).success, false)
  assert.equal(createSolicitacaoBodySchema.safeParse(semValor).success, false)
})

test('rejeita turno com enum inválido', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, turno: 'MADRUGADA' }).success, false)
})

test('rejeita frequencia com enum inválido', () => {
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, frequencia: 'ANUAL' }).success, false)
})

test('exige recorrência de pagamento válida', () => {
  const { paymentRecurrence, ...semRecorrencia } = BASE
  assert.equal(createSolicitacaoBodySchema.safeParse(semRecorrencia).success, false)
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, paymentRecurrence: 'QUINZENAL' }).success, false)
  assert.equal(createSolicitacaoBodySchema.safeParse({ ...BASE, paymentRecurrence: 'MENSAL' }).success, true)
})
