import prisma from '../lib/prisma.js'

/** Marca cobrança como paga após confirmação do PIX. */
export async function markChargeRequestPaid(chargeRequestId) {
  if (!chargeRequestId) return
  await prisma.chargeRequest.updateMany({
    where: { id: chargeRequestId, status: 'PENDING' },
    data: { status: 'PAID' },
  })
}

/**
 * Marca cobrança pendente vinculada ao pagamento (familiar + cuidador + valor total).
 * Chamado somente após o gateway confirmar PAID.
 */
export async function markChargePaidForPayment(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { escrow: { select: { payeeId: true } } },
  })
  if (!payment?.escrow?.payeeId) return

  await prisma.chargeRequest.updateMany({
    where: {
      familiarId: payment.userId,
      caregiverId: payment.escrow.payeeId,
      totalAmount: payment.amount,
      status: 'PENDING',
    },
    data: { status: 'PAID' },
  })
}
