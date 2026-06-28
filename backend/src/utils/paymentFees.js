/**
 * Cálculo do valor total da cobrança (em centavos).
 * Fórmula: Total = x + (x * 0.07) + 0.80
 *   - x = valor base informado pelo cuidador
 *   - 7% = taxa percentual da plataforma
 *   - R$ 0,80 = taxa fixa (80 centavos)
 * @param {number} baseCents - valor base x em centavos
 * @returns {{ baseCents: number, platformFeeCents: number, fixedFeeCents: number, totalCents: number }}
 */
export function calculateChargeTotalCents(baseCents) {
  const platformFeeCents = Math.round(baseCents * 0.07)
  const fixedFeeCents = 80
  const totalCents = baseCents + platformFeeCents + fixedFeeCents
  return { baseCents, platformFeeCents, fixedFeeCents, totalCents }
}
