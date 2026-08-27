// Espelha backend/src/utils/specialties.js — mesmos values.
export const SPECIALTIES = [
  { value: 'IDOSOS', label: 'Idosos' },
  { value: 'ALZHEIMER_DEMENCIA', label: 'Alzheimer/Demência' },
  { value: 'POS_CIRURGICO', label: 'Pós-cirúrgico' },
  { value: 'FISIOTERAPIA', label: 'Fisioterapia' },
  { value: 'CUIDADOS_PALIATIVOS', label: 'Cuidados paliativos' },
  { value: 'MOBILIDADE_REDUZIDA', label: 'Mobilidade reduzida' },
  { value: 'DIABETES', label: 'Diabetes' },
  { value: 'AVC_DERRAME', label: 'AVC/Derrame' },
  { value: 'SAUDE_MENTAL', label: 'Saúde mental' },
  { value: 'CRIANCAS_NECESSIDADES_ESPECIAIS', label: 'Crianças com necessidades especiais' },
  { value: 'ACAMADOS', label: 'Acamados' },
  { value: 'HOME_CARE_24H', label: 'Home care 24h' },
  { value: 'PARKINSON', label: 'Parkinson' },
  { value: 'HIPERTENSAO', label: 'Hipertensão' },
  { value: 'REABILITACAO', label: 'Reabilitação' },
  { value: 'ACOMPANHAMENTO_DIURNO', label: 'Acompanhamento diurno' },
  { value: 'PERNOITE', label: 'Pernoite' },
]

export const SPECIALTY_VALUES = SPECIALTIES.map((s) => s.value)

const LABEL_BY_VALUE = Object.fromEntries(SPECIALTIES.map((s) => [s.value, s.label]))

/** Rótulo visível de uma especialidade; devolve o próprio valor se não estiver na lista fixa (dado legado em texto livre). */
export function specialtyLabel(value) {
  return LABEL_BY_VALUE[value] ?? value
}
