import { describe, it, expect } from 'vitest'
import {
  TURNOS,
  FREQUENCIAS,
  TURNO_VALUES,
  FREQUENCIA_VALUES,
  turnoLabel,
  frequenciaLabel,
} from './solicitacaoOptions'

describe('paridade FE↔BE das opções de solicitação', () => {
  it('TURNO_VALUES bate exatamente com o backend', () => {
    expect(TURNO_VALUES).toEqual(['MANHA', 'TARDE', 'NOITE', 'INTEGRAL', 'A_COMBINAR'])
  })

  it('FREQUENCIA_VALUES bate exatamente com o backend', () => {
    expect(FREQUENCIA_VALUES).toEqual(['PONTUAL', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL'])
  })

  it('TURNO_VALUES/FREQUENCIA_VALUES derivam dos values das listas', () => {
    expect(TURNO_VALUES).toEqual(TURNOS.map((t) => t.value))
    expect(FREQUENCIA_VALUES).toEqual(FREQUENCIAS.map((f) => f.value))
  })
})

describe('helpers de label', () => {
  it('turnoLabel converte value conhecido', () => {
    expect(turnoLabel('A_COMBINAR')).toBe('A combinar')
  })

  it('frequenciaLabel converte value conhecido', () => {
    expect(frequenciaLabel('QUINZENAL')).toBe('Quinzenal')
  })

  it('devolve o próprio valor quando desconhecido', () => {
    expect(turnoLabel('X')).toBe('X')
    expect(frequenciaLabel('Y')).toBe('Y')
  })
})
