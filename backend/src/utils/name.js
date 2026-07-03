/** Validação de nome de pessoa: letras (com acento), espaço, ponto, hífen e apóstrofo. */
export function isValidName(value) {
  const name = String(value ?? '').trim()
  if (name.length < 2) return false
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return false
  // rejeita repetição da mesma letra (AAAA), ignorando separadores
  const letters = name.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 2 && /^(.)\1+$/u.test(letters)) return false
  return true
}
