/** Formata valor/hora em BRL ou retorna null se inválido. */
export function formatHourly(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return null
  return `${Number(rate).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h`
}

/** Máscara visual de CEP: 00000-000 (mesmo estilo de maskCpf). */
export function maskCep(value) {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

/**
 * Máscara de moeda BRL para input controlado: trata os dígitos digitados
 * como centavos (ex.: "2500" → "R$ 25,00"). Usar com parseCurrencyInput
 * pra extrair o valor numérico antes de enviar ao backend.
 */
export function maskCurrencyInput(rawValue) {
  const digits = String(rawValue ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const reais = parseInt(digits, 10) / 100
  return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Extrai o valor numérico (em reais, string com 2 casas) de um valor mascarado em BRL. */
export function parseCurrencyInput(masked) {
  const digits = String(masked ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return (parseInt(digits, 10) / 100).toFixed(2)
}

/** Formata uma data date-only ('YYYY-MM-DD') em dd/mm/aaaa, sem sofrer deslocamento de fuso (não passa por Date UTC). */
export function formatDateOnly(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}
