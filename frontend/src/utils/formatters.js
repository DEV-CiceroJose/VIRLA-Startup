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
