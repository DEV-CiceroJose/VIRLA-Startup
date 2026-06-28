/**
 * Valida CPF brasileiro pelos dígitos verificadores (não apenas formato).
 * Remove pontuação antes do cálculo.
 * @param {string} value
 */
export function stripCpf(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidCPF(value) {
  const cpf = stripCpf(value)
  if (cpf.length !== 11) return false
  // Rejeita sequências repetidas (111.111.111-11, etc.)
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
