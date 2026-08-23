import { getUserById, updateUser } from '../repositories/userRepository.js'
import {
  createRecipientAccount,
  createRecipientOnboardingLink,
  getRecipientAccountStatus,
  getStripeClient,
} from '../services/stripeService.js'
import { logger } from '../lib/logger.js'

export async function getConnectStatus(req, res) {
  try {
    const user = await getUserById(req.userId)
    if (!user?.stripeAccountId) {
      return res.status(200).json({ connected: false, ready: false, status: 'NOT_STARTED' })
    }
    const result = await getRecipientAccountStatus(user.stripeAccountId)
    return res.status(200).json({
      connected: true,
      ready: result.ready,
      status: result.ready ? 'READY' : 'REQUIREMENTS_PENDING',
      transferStatus: result.transferStatus,
      payoutStatus: result.payoutStatus,
    })
  } catch (err) {
    logger.error('stripe:connect_status_failed', { error: err.message, userId: req.userId })
    return res.status(err.statusCode ?? 502).json({ msg: 'Não foi possível consultar o cadastro de recebimento.' })
  }
}

export async function createConnectOnboarding(req, res) {
  try {
    let user = await getUserById(req.userId)
    if (!user) return res.status(404).json({ msg: 'Cuidador não encontrado.' })

    if (!user.stripeAccountId) {
      const account = await createRecipientAccount(user)
      user = await updateUser(user.id, { stripeAccountId: account.id })
      logger.info('stripe:connected_account_created', { userId: user.id, stripeAccountId: account.id })
    }

    const link = await createRecipientOnboardingLink(user.stripeAccountId)
    return res.status(201).json({ url: link.url, expiresAt: link.expires_at })
  } catch (err) {
    logger.error('stripe:connect_onboarding_failed', { error: err.message, userId: req.userId })
    return res.status(err.statusCode ?? 502).json({ msg: 'Não foi possível iniciar o cadastro de recebimento.' })
  }
}

export async function createConnectDashboardLink(req, res) {
  try {
    const user = await getUserById(req.userId)
    if (!user?.stripeAccountId) return res.status(409).json({ msg: 'Conclua primeiro o cadastro de recebimento.' })
    const link = await getStripeClient().accounts.createLoginLink(user.stripeAccountId)
    return res.status(201).json({ url: link.url })
  } catch (err) {
    logger.error('stripe:connect_dashboard_failed', { error: err.message, userId: req.userId })
    return res.status(err.statusCode ?? 502).json({ msg: 'Não foi possível abrir o painel de recebimentos.' })
  }
}

