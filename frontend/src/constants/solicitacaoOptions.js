// Espelha backend/src/utils/solicitacaoOptions.js — mesmos values.
export const TURNOS = [
  { value: 'MANHA', label: 'Manhã' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'NOITE', label: 'Noite' },
  { value: 'INTEGRAL', label: 'Integral' },
  { value: 'A_COMBINAR', label: 'A combinar' },
]

export const FREQUENCIAS = [
  { value: 'PONTUAL', label: 'Pontual' },
  { value: 'DIARIA', label: 'Diária' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'QUINZENAL', label: 'Quinzenal' },
  { value: 'MENSAL', label: 'Mensal' },
]

export const TURNO_VALUES = TURNOS.map((t) => t.value)
export const FREQUENCIA_VALUES = FREQUENCIAS.map((f) => f.value)

export const PAYMENT_RECURRENCES = [
  { value: 'DIARIA', label: 'Diária' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'MENSAL', label: 'Mensal' },
]

export const PAYMENT_RECURRENCE_VALUES = PAYMENT_RECURRENCES.map((item) => item.value)

const TURNO_LABEL = Object.fromEntries(TURNOS.map((t) => [t.value, t.label]))
const FREQ_LABEL = Object.fromEntries(FREQUENCIAS.map((f) => [f.value, f.label]))
const PAYMENT_RECURRENCE_LABEL = Object.fromEntries(PAYMENT_RECURRENCES.map((item) => [item.value, item.label]))

/** Rótulo visível do turno; devolve o próprio valor se desconhecido. */
export function turnoLabel(value) {
  return TURNO_LABEL[value] ?? value
}

/** Rótulo visível da frequência; devolve o próprio valor se desconhecido. */
export function frequenciaLabel(value) {
  return FREQ_LABEL[value] ?? value
}

export function paymentRecurrenceLabel(value) {
  return PAYMENT_RECURRENCE_LABEL[value] ?? value
}
