import prisma from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { calculateChargeTotalCents } from '../utils/paymentFees.js'
/**
 * POST /payments/charge-requests
 * CUIDADOR (requireRole): gera cobrança com taxas e encaminha ao familiar.
 */
export const createChargeRequest = async (req, res) => {
  try {
    const caregiverId = req.userId
    const { familiarId, baseAmount, description } = req.body

    if (familiarId === caregiverId) {
      return res.status(422).json({ msg: 'O familiar não pode ser você mesmo.' })
    }

    const familiar = await prisma.user.findUnique({ where: { id: familiarId } })
    if (!familiar) {
      return res.status(404).json({ msg: 'Familiar não encontrado.' })
    }
    if (familiar.role !== 'FAMILIAR') {
      return res.status(422).json({ msg: 'A cobrança deve ser enviada a um usuário Familiar.' })
    }

    const { totalCents, platformFeeCents, fixedFeeCents } = calculateChargeTotalCents(baseAmount)

    await prisma.chargeRequest.updateMany({
      where: {
        caregiverId,
        familiarId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    })

    const charge = await prisma.chargeRequest.create({
      data: {
        caregiverId,
        familiarId,
        baseAmount,
        totalAmount: totalCents,
        description,
      },
    })

    return res.status(201).json({
      chargeRequestId: charge.id,
      baseAmount,
      platformFeeCents,
      fixedFeeCents,
      totalAmount: totalCents,
      description: charge.description,
      familiarId,
      caregiverId,
      status: charge.status,
    })
  } catch (err) {
    logger.error('charge:create_failed', { error: err.message, stack: err.stack, userId: req.userId, endpoint: req.originalUrl })
    return res.status(500).json({ msg: 'Erro ao gerar cobrança.' })
  }
}

/**
 * GET /payments/charge-requests/pending/:peerId
 * Retorna cobrança PENDING entre o usuário logado e o peer (chat).
 */
export const getPendingChargeWithPeer = async (req, res) => {
  try {
    const userId = req.userId
    const { peerId } = req.params

    const user = await prisma.user.findUnique({ where: { id: userId } })
    const peer = await prisma.user.findUnique({ where: { id: peerId } })
    if (!user || !peer) {
      return res.status(404).json({ msg: 'Usuário não encontrado.' })
    }

    const charge = await prisma.chargeRequest.findFirst({
      where: {
        status: 'PENDING',
        OR: [
          { caregiverId: userId, familiarId: peerId },
          { caregiverId: peerId, familiarId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        caregiver: { select: { id: true, name: true, role: true } },
        familiar: { select: { id: true, name: true, role: true } },
      },
    })

    if (!charge) {
      return res.status(200).json({ charge: null })
    }

    // Familiar só vê cobrança destinada a ele; cuidador só a que ele gerou.
    if (user.role === 'FAMILIAR' && charge.familiarId !== userId) {
      return res.status(200).json({ charge: null })
    }
    if (user.role === 'CUIDADOR' && charge.caregiverId !== userId) {
      return res.status(200).json({ charge: null })
    }

    return res.status(200).json({
      charge: {
        id: charge.id,
        baseAmount: charge.baseAmount,
        totalAmount: charge.totalAmount,
        description: charge.description,
        status: charge.status,
        caregiverId: charge.caregiverId,
        familiarId: charge.familiarId,
        caregiverName: charge.caregiver.name,
        familiarName: charge.familiar.name,
      },
    })
  } catch (err) {
    logger.error('charge:get_pending_failed', { error: err.message, stack: err.stack, userId: req.userId, endpoint: req.originalUrl })
    return res.status(500).json({ msg: 'Erro ao buscar cobrança pendente.' })
  }
}
