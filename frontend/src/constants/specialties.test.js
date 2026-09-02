import { describe, it, expect } from 'vitest'
import { SPECIALTIES, SPECIALTY_VALUES, specialtyLabel } from './specialties'

describe('SPECIALTIES', () => {
  it('tem 17 itens únicos', () => {
    expect(SPECIALTIES).toHaveLength(17)
    expect(new Set(SPECIALTY_VALUES).size).toBe(17)
  })

  it('SPECIALTY_VALUES é a lista de values de SPECIALTIES, na mesma ordem', () => {
    expect(SPECIALTY_VALUES).toEqual(SPECIALTIES.map((s) => s.value))
  })
})

describe('specialtyLabel', () => {
  it('retorna o label correspondente a um value conhecido', () => {
    expect(specialtyLabel('IDOSOS')).toBe('Idosos')
  })

  it('retorna o label correspondente para outro value conhecido', () => {
    expect(specialtyLabel('AVC_DERRAME')).toBe('AVC/Derrame')
  })

  it('devolve o próprio valor quando não está na lista fixa (dado legado em texto livre)', () => {
    expect(specialtyLabel('Texto livre antigo')).toBe('Texto livre antigo')
  })
})
