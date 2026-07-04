import test from 'node:test'
import assert from 'node:assert/strict'
import { createUserBodySchema, updateUserBodySchema, profileImageSchema } from '../src/schemas/userSchemas.js'

// helper: data de 30 anos atrás (adulto válido) no formato YYYY-MM-DD
function adultoISO() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 30)
  return d.toISOString().split('T')[0]
}

test('createUserBodySchema NÃO exige password (auth é do Firebase)', () => {
  const r = createUserBodySchema.safeParse({
    name: 'Ana Silva',
    role: 'FAMILIAR',
    cpf: '390.533.447-05', // CPF válido
    birthDate: adultoISO(),
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

test('createUserBodySchema exige birthDate', () => {
  const r = createUserBodySchema.safeParse({ name: 'Ana Silva', role: 'FAMILIAR', cpf: '390.533.447-05' })
  assert.equal(r.success, false)
})

test('createUserBodySchema aceita birthDate de adulto', () => {
  const r = createUserBodySchema.safeParse({
    name: 'Ana Silva', role: 'FAMILIAR', cpf: '390.533.447-05', birthDate: adultoISO(),
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})

test('createUserBodySchema rejeita menor de 18', () => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 10)
  const r = createUserBodySchema.safeParse({
    name: 'Ana', role: 'FAMILIAR', cpf: '390.533.447-05', birthDate: d.toISOString().split('T')[0],
  })
  assert.equal(r.success, false)
})

test('updateUserBodySchema aceita ausência de birthDate', () => {
  const r = updateUserBodySchema.safeParse({ name: 'Novo Nome' })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})

test('updateUserBodySchema rejeita birthDate futura quando enviada', () => {
  const futuro = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const r = updateUserBodySchema.safeParse({ birthDate: futuro })
  assert.equal(r.success, false)
})

const baseCreate = { role: 'FAMILIAR', cpf: '390.533.447-05', birthDate: adultoISO() }

test('createUserBodySchema rejeita nome inválido', () => {
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana123' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza' }).success, true)
})

test('hourlyRate: fora de 10–500 falha; dentro passa; ausente ok', () => {
  const ok = createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 25 })
  assert.equal(ok.success, true, JSON.stringify(ok.error?.issues))
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 5 }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 900 }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 'abc' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza' }).success, true) // ausente
})

test('profileImageSchema aceita ~5MB e rejeita prefixo não-imagem', () => {
  const big = 'data:image/png;base64,' + 'A'.repeat(6_000_000)
  assert.equal(profileImageSchema.safeParse(big).success, true)
  assert.equal(profileImageSchema.safeParse('data:text/html;base64,AAAA').success, false)
})

test('registro: par válido ok; só um dos dois falha; ambos ausentes ok', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'COREN', registerNumber: '123456' }).success, true)
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'COREN' }).success, false) // sem número
  assert.equal(createUserBodySchema.safeParse({ ...base, registerNumber: '123456' }).success, false) // sem conselho
  assert.equal(createUserBodySchema.safeParse({ ...base }).success, true) // nenhum
})

test('registro: formato inválido para o conselho falha', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'COREN', registerNumber: 'abc' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'XPTO', registerNumber: '123456' }).success, false)
})

test('crm_crf não é mais aceito no update (strict)', () => {
  assert.equal(updateUserBodySchema.safeParse({ crm_crf: '123' }).success, false)
})

test('specialties: aceita valores da lista fixa; rejeita valor fora da lista; rejeita mais de 12 itens', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  const ok = createUserBodySchema.safeParse({ ...base, specialties: ['IDOSOS', 'DIABETES'] })
  assert.equal(ok.success, true, JSON.stringify(ok.error?.issues))

  assert.equal(createUserBodySchema.safeParse({ ...base, specialties: ['NAO_EXISTE'] }).success, false)

  const treze = Array(13).fill('IDOSOS')
  assert.equal(createUserBodySchema.safeParse({ ...base, specialties: treze }).success, false)

  assert.equal(createUserBodySchema.safeParse({ ...base }).success, true) // ausente ok
})

test('specialties: string livre (formato pré-FE-06) não é mais aceita', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  assert.equal(createUserBodySchema.safeParse({ ...base, specialties: 'Idosos, Diabetes' }).success, false)
})

test('zipCode: aceita com/sem hífen e normaliza pra 8 dígitos; rejeita formato inválido; ausente ok', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }

  const comHifen = createUserBodySchema.safeParse({ ...base, zipCode: '50030-230' })
  assert.equal(comHifen.success, true, JSON.stringify(comHifen.error?.issues))
  assert.equal(comHifen.data.zipCode, '50030230')

  const semHifen = createUserBodySchema.safeParse({ ...base, zipCode: '50030230' })
  assert.equal(semHifen.success, true)
  assert.equal(semHifen.data.zipCode, '50030230')

  assert.equal(createUserBodySchema.safeParse({ ...base, zipCode: '123' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...base }).success, true)
})
