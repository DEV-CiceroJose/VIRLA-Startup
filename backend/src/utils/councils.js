/**
 * Conselhos profissionais aceitos e validação (pragmática) do número de registro.
 * Formatos reais variam por estado — os padrões validam estrutura básica, sem
 * pretender exaustividade, para não rejeitar registros válidos.
 */

const REGISTER_BASE = /^\d{4,10}([-/][A-Za-z0-9]{1,5})?$/ // dígitos + sufixo opcional (UF/categoria)

export const COUNCILS = {
  COREN:   { label: 'COREN — Enfermagem',     pattern: REGISTER_BASE },
  CRM:     { label: 'CRM — Medicina',         pattern: REGISTER_BASE },
  CRP:     { label: 'CRP — Psicologia',       pattern: /^\d{2}[-/]\d{3,7}$/ }, // região/número (ex.: 06/12345)
  CREFITO: { label: 'CREFITO — Fisio/TO',     pattern: REGISTER_BASE },
  CREF:    { label: 'CREF — Educação Física', pattern: REGISTER_BASE },
  CRF:     { label: 'CRF — Farmácia',         pattern: REGISTER_BASE },
}

export const COUNCIL_VALUES = Object.keys(COUNCILS)

export function isValidCouncil(v) {
  return typeof v === 'string' && v in COUNCILS
}

export function isValidRegister(council, number) {
  const c = COUNCILS[council]
  if (!c) return false
  return c.pattern.test(String(number ?? '').trim())
}
