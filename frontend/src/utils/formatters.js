/** Formata valor/hora em BRL ou retorna null se inválido. */
export function formatHourly(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return null
  return `${Number(rate).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h`
}
