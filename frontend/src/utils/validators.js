/** Remove pontuação do CPF antes da validação. */
export function stripCpf(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Máscara visual: 000.000.000-00 */
export function maskCpf(value) {
  const d = stripCpf(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

/**
 * Valida dígitos verificadores do CPF (não apenas tamanho/formato).
 */
export function isValidCpf(value) {
  const cpf = stripCpf(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
  let d1 = (sum * 10) % 11
  if (d1 === 10) d1 = 0
  if (d1 !== Number(cpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
  let d2 = (sum * 10) % 11
  if (d2 === 10) d2 = 0
  return d2 === Number(cpf[10])
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function isValidEmail(value) {
  const email = String(value ?? '').trim()
  if (!email || email.length > 254) return false
  if (!EMAIL_REGEX.test(email)) return false
  const domain = email.split('@')[1]
  if (!domain || !domain.includes('.')) return false
  const tld = domain.split('.').pop()
  return Boolean(tld && tld.length >= 2)
}
