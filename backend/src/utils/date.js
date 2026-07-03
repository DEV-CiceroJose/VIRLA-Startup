/**
 * Utilitários de data de nascimento — validação anti data-futura/menor-de-idade.
 */

/** Idade em anos completos até `now`. Aceita Date ou string parseável. */
export function calculateAge(birthDate, now = new Date()) {
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate)
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const m = now.getUTCMonth() - birth.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--
  return age
}

/**
 * Valida uma data de nascimento: obrigatória, parseável, não futura, e com
 * idade entre minAge e maxAge.
 * @returns {{ valid: true, date: Date } | { valid: false, error: string }}
 */
export function validateBirthDate(value, { minAge = 18, maxAge = 110 } = {}) {
  if (value == null || value === '') {
    return { valid: false, error: 'Data de nascimento é obrigatória.' }
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { valid: false, error: 'Data de nascimento inválida.' }
  }
  const now = new Date()
  if (date.getTime() > now.getTime()) {
    return { valid: false, error: 'Data de nascimento não pode ser futura.' }
  }
  const age = calculateAge(date, now)
  if (age < minAge) {
    return { valid: false, error: `É necessário ter pelo menos ${minAge} anos.` }
  }
  if (age > maxAge) {
    return { valid: false, error: 'Data de nascimento inválida.' }
  }
  return { valid: true, date }
}
