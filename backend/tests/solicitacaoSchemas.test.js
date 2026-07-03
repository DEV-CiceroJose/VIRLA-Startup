import test from 'node:test'
import assert from 'node:assert/strict'
import { createSolicitacaoBodySchema } from '../src/schemas/solicitacaoSchemas.js'

test('createSolicitacaoBodySchema aceita cidade/estado null (edição de solicitação salva)', () => {
  const r = createSolicitacaoBodySchema.safeParse({
    titulo: 'Preciso de cuidador',
    descricao: 'Descrição com detalhes suficientes.',
    cidade: null,
    estado: null,
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})

test('createSolicitacaoBodySchema ainda aceita cidade/estado string', () => {
  const r = createSolicitacaoBodySchema.safeParse({
    titulo: 'Preciso de cuidador',
    descricao: 'Descrição com detalhes suficientes.',
    cidade: 'Fortaleza',
    estado: 'CE',
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})
