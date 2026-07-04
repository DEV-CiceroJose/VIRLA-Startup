import { describe, it, expect } from 'vitest'
import { formatHourly, maskCep, maskCurrencyInput, parseCurrencyInput } from './formatters'

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

describe('maskCurrencyInput / parseCurrencyInput (FE-03)', () => {
  it('maskCurrencyInput trata os dígitos digitados como centavos', () => {
    expect(maskCurrencyInput('2500')).toMatch(/R\$\s?25,00/)
    expect(maskCurrencyInput('150')).toMatch(/R\$\s?1,50/)
    expect(maskCurrencyInput('')).toBe('')
  })

  it('maskCurrencyInput ignora caracteres não-numéricos', () => {
    expect(maskCurrencyInput('R$ 25,00')).toMatch(/R\$\s?25,00/)
  })

  it('parseCurrencyInput extrai o valor numérico em reais (string com 2 casas)', () => {
    expect(parseCurrencyInput('R$ 25,00')).toBe('25.00')
    expect(parseCurrencyInput('R$ 150,00')).toBe('150.00')
    expect(parseCurrencyInput('')).toBe('')
  })

  it('maskCurrencyInput e parseCurrencyInput são inversos pro caso comum', () => {
    const masked = maskCurrencyInput('2500')
    expect(parseCurrencyInput(masked)).toBe('25.00')
  })
})
