import { describe, it, expect } from 'vitest'
import { formatLastSeen } from './lastSeen'

// Referência fixa: quarta-feira, 2026-07-15 14:30:00 (horário local do runner).
const NOW = new Date(2026, 6, 15, 14, 30, 0, 0).getTime()

describe('formatLastSeen', () => {
  it('vazio/inválido → string vazia', () => {
    expect(formatLastSeen(null, NOW)).toBe('')
    expect(formatLastSeen(undefined, NOW)).toBe('')
    expect(formatLastSeen(NaN, NOW)).toBe('')
  })
  it('menos de 1 min → "agora mesmo"', () => {
    expect(formatLastSeen(NOW - 30_000, NOW)).toBe('agora mesmo')
    expect(formatLastSeen(NOW - 59_000, NOW)).toBe('agora mesmo')
  })
  it('menos de 1h → "há N min" (mínimo 1)', () => {
    expect(formatLastSeen(NOW - 60_000, NOW)).toBe('há 1 min')
    expect(formatLastSeen(NOW - 5 * 60_000, NOW)).toBe('há 5 min')
    expect(formatLastSeen(NOW - 59 * 60_000, NOW)).toBe('há 59 min')
  })
  it('mesmo dia (>1h atrás) → "hoje às HH:MM"', () => {
    const dozeE05 = new Date(2026, 6, 15, 12, 5, 0, 0).getTime()
    expect(formatLastSeen(dozeE05, NOW)).toBe('hoje às 12:05')
  })
  it('dia anterior → "ontem às HH:MM"', () => {
    const ontem2245 = new Date(2026, 6, 14, 22, 45, 0, 0).getTime()
    expect(formatLastSeen(ontem2245, NOW)).toBe('ontem às 22:45')
  })
  it('mais antigo → "DD/MM às HH:MM"', () => {
    const antigo = new Date(2026, 6, 10, 9, 7, 0, 0).getTime()
    expect(formatLastSeen(antigo, NOW)).toBe('10/07 às 09:07')
  })
})
