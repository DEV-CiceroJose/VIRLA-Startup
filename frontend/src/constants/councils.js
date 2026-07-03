// Conselhos profissionais (valores devem bater com backend/src/utils/councils.js).
export const COUNCILS = [
  { value: 'COREN', label: 'COREN — Enfermagem' },
  { value: 'CRM', label: 'CRM — Medicina' },
  { value: 'CRP', label: 'CRP — Psicologia' },
  { value: 'CREFITO', label: 'CREFITO — Fisio/TO' },
  { value: 'CREF', label: 'CREF — Educação Física' },
  { value: 'CRF', label: 'CRF — Farmácia' },
]

// Validação de formato do número de registro (espelha backend/src/utils/councils.js).
const REGISTER_BASE = /^\d{4,10}([-/][A-Za-z0-9]{1,5})?$/
const PATTERNS = {
  COREN: REGISTER_BASE,
  CRM: REGISTER_BASE,
  CRP: /^\d{2}[-/]\d{3,7}$/,
  CREFITO: REGISTER_BASE,
  CREF: REGISTER_BASE,
  CRF: REGISTER_BASE,
}

export function isValidRegister(council, number) {
  const p = PATTERNS[council]
  if (!p) return false
  return p.test(String(number ?? '').trim())
}
