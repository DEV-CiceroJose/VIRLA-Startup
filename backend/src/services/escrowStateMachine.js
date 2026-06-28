/**
 * Máquina de estados da custódia Escrow.
 *
 * Estados terminais (imutáveis após conclusão): RELEASED.
 * DISPUTED é transitório — apenas HELD → DISPUTED → RELEASED.
 */

/** @type {import('@prisma/client').EscrowStatus[]} */
export const TERMINAL_ESCROW_STATUSES = ['RELEASED']

/** @type {Record<string, import('@prisma/client').EscrowStatus[]>} */
const ALLOWED_TRANSITIONS = {
  PENDING: ['HELD'],
  HELD: ['DISPUTED', 'RELEASED'],
  DISPUTED: ['RELEASED'],
  RELEASED: [],
}

/**
 * Indica se o estado atual não permite mais transições.
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminalEscrowStatus(status) {
  return TERMINAL_ESCROW_STATUSES.includes(status)
}

/**
 * Valida se a transição de estado é permitida pela máquina.
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {{ allowed: boolean; error?: string }}
 */
export function assertEscrowTransition(fromStatus, toStatus) {
  if (isTerminalEscrowStatus(fromStatus)) {
    return {
      allowed: false,
      error: `Escrow em estado final "${fromStatus}" — transição para "${toStatus}" bloqueada.`,
    }
  }

  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? []
  if (!allowed.includes(toStatus)) {
    return {
      allowed: false,
      error: `Transição inválida: ${fromStatus} → ${toStatus}.`,
    }
  }

  return { allowed: true }
}
