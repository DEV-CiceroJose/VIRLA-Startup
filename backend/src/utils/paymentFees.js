/**
 * Mantém o formato histórico do cálculo, mas sem acrescentar taxa ao contrato.
 * O familiar paga exatamente o valor calculado a partir da solicitação.
 * @param {number} baseCents - valor base x em centavos
 * @returns {{ baseCents: number, platformFeeCents: number, fixedFeeCents: number, totalCents: number }}
 */
export function calculateChargeTotalCents(baseCents) {
  const platformFeeCents = 0
  const fixedFeeCents = 0
  const totalCents = baseCents
  return { baseCents, platformFeeCents, fixedFeeCents, totalCents }
}
