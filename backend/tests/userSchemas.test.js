import test from 'node:test'
import assert from 'node:assert/strict'
import { createUserBodySchema } from '../src/schemas/userSchemas.js'

test('createUserBodySchema NÃO exige password (auth é do Firebase)', () => {
  const r = createUserBodySchema.safeParse({
    name: 'Ana Silva',
    role: 'FAMILIAR',
    cpf: '390.533.447-05', // CPF válido
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
  assert.equal('password' in r.data, false)
})

test('createUserBodySchema exige role válido', () => {
  const r = createUserBodySchema.safeParse({ name: 'Ana', role: 'OUTRO', cpf: '390.533.447-05' })
  assert.equal(r.success, false)
})

test('createUserBodySchema exige CPF válido', () => {
  const r = createUserBodySchema.safeParse({ name: 'Ana', role: 'FAMILIAR', cpf: '111.111.111-11' })
  assert.equal(r.success, false)
})
