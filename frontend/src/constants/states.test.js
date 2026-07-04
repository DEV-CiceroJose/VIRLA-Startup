import { describe, it, expect } from 'vitest'
import { STATES } from './states'

describe('STATES', () => {
  it('tem as 27 UFs, sem duplicatas', () => {
    expect(STATES).toHaveLength(27)
    const values = STATES.map((s) => s.value)
    expect(new Set(values).size).toBe(27)
  })

  it('todo value tem exatamente 2 letras maiúsculas', () => {
    for (const s of STATES) {
      expect(s.value).toMatch(/^[A-Z]{2}$/)
    }
  })
})
