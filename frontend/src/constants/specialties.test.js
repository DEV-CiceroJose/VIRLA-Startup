import { describe, it, expect } from 'vitest'
import { SPECIALTIES, SPECIALTY_VALUES } from './specialties'

describe('SPECIALTIES', () => {
  it('tem 12 itens únicos', () => {
    expect(SPECIALTIES).toHaveLength(12)
    expect(new Set(SPECIALTY_VALUES).size).toBe(12)
  })

  it('SPECIALTY_VALUES é a lista de values de SPECIALTIES, na mesma ordem', () => {
    expect(SPECIALTY_VALUES).toEqual(SPECIALTIES.map((s) => s.value))
  })
})
