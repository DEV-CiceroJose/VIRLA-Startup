import * as chargeRepo from '../repositories/chargeRequestRepository.js'
import { getById as getPaymentById } from '../repositories/paymentRepository.js'
import { getByPaymentId as getEscrowByPaymentId } from '../repositories/escrowRepository.js'

/** Marca cobrança como paga após confirmação do PIX. */
export async function markChargeRequestPaid(chargeRequestId) {
  if (!chargeRequestId) return
  await chargeRepo.markPaidById(chargeRequestId)
}

/**
 * Marca cobrança pendente vinculada ao pagamento (familiar + cuidador + valor total).
 * Chamado somente após o gateway confirmar PAID.
 */
export async function markChargePaidForPayment(paymentId) {
  const payment = await getPaymentById(paymentId)
  if (!payment) return

  const escrow = await getEscrowByPaymentId(paymentId)
  if (!escrow?.payeeId) return

  await chargeRepo.markPaidForTriple(payment.userId, escrow.payeeId, payment.amount)
}
