/**
 * O total corresponde ao valor do contrato, sem taxa adicional da plataforma.
 */
export function calculateChargeTotalCents(baseCents) {
  const platformFeeCents = 0
  const fixedFeeCents = 0
  const totalCents = baseCents
  return { baseCents, platformFeeCents, fixedFeeCents, totalCents }
}

/** Converte reais (string/number) para centavos inteiros. */
export function reaisToCents(reais) {
  const n = typeof reais === 'number' ? reais : parseFloat(String(reais).replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

export function formatCentsBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
