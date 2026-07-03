import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAge, validateBirthDate } from '../src/utils/date.js'

const REF = new Date('2026-07-02T12:00:00Z')

test('calculateAge conta anos completos', () => {
  assert.equal(calculateAge(new Date('2000-07-02T12:00:00Z'), REF), 26)
  assert.equal(calculateAge(new Date('2000-07-03T12:00:00Z'), REF), 25) // aniversário ainda não ocorreu
})

test('validateBirthDate: quem faz 18 amanhã é rejeitado; quem já fez é aceito', () => {
  const now = new Date('2026-07-02T12:00:00Z')
  // faz 18 amanhã (2026-07-03) → nasceu 2008-07-03 → hoje ainda tem 17
  assert.equal(calculateAge('2008-07-03', now), 17)
  // fez 18 hoje (nasceu 2008-07-02) → 18
  assert.equal(calculateAge('2008-07-02', now), 18)
})

test('validateBirthDate rejeita ausência', () => {
  assert.equal(validateBirthDate('').valid, false)
  assert.equal(validateBirthDate(null).valid, false)
})

test('validateBirthDate rejeita data inválida', () => {
  assert.equal(validateBirthDate('não-é-data').valid, false)
})

test('validateBirthDate rejeita data futura', () => {
  const futuro = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  assert.equal(validateBirthDate(futuro).valid, false)
})

test('validateBirthDate rejeita menor de 18', () => {
  const dezAnos = new Date()
  dezAnos.setFullYear(dezAnos.getFullYear() - 10)
  assert.equal(validateBirthDate(dezAnos.toISOString().split('T')[0]).valid, false)
})

test('validateBirthDate rejeita idade absurda (>110)', () => {
  assert.equal(validateBirthDate('1900-01-01').valid, false)
})

test('validateBirthDate aceita adulto válido', () => {
  const trintaAnos = new Date()
  trintaAnos.setFullYear(trintaAnos.getFullYear() - 30)
  const r = validateBirthDate(trintaAnos.toISOString().split('T')[0])
  assert.equal(r.valid, true)
  assert.ok(r.date instanceof Date)
})
