import { describe, it, expect } from 'vitest'
import { formatHourly, maskCep } from './formatters'

describe('formatHourly (regressão)', () => {
  it('formata número como BRL/h', () => {
    expect(formatHourly(25)).toMatch(/R\$\s?25,00\/h/)
  })

  it('retorna null pra valor inválido', () => {
    expect(formatHourly(null)).toBe(null)
    expect(formatHourly('abc')).toBe(null)
  })
})

describe('maskCep (FE-02)', () => {
  it('formata 8 dígitos como 00000-000', () => {
    expect(maskCep('50030230')).toBe('50030-230')
  })

  it('formata parcialmente enquanto o usuário digita', () => {
    expect(maskCep('500')).toBe('500')
    expect(maskCep('50030')).toBe('50030')
    expect(maskCep('500302')).toBe('50030-2')
  })

  it('ignora caracteres não-numéricos e trunca em 8 dígitos', () => {
    expect(maskCep('50.030-230999')).toBe('50030-230')
  })
})
