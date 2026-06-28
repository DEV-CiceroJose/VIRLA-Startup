/**
 * Total = x + (x * 0.07) + 0.80 — valores em centavos (x = base informada pelo cuidador).
 */
export function calculateChargeTotalCents(baseCents) {
  const platformFeeCents = Math.round(baseCents * 0.07)
  const fixedFeeCents = 80
  const totalCents = baseCents + platformFeeCents + fixedFeeCents
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
