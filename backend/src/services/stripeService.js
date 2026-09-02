import crypto from 'crypto'
import Stripe from 'stripe'
import { logger } from '../lib/logger.js'

export const STRIPE_API_VERSION = '2026-07-29.dahlia'

let client

export function getStripeClient() {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    const err = new Error('Stripe não está configurado neste ambiente.')
    err.statusCode = 503
    throw err
  }
  client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: 'VIRLA', version: '1.0.0', url: 'https://virla-app.onrender.com' },
  })
  return client
}

export function frontendUrl(path = '') {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').trim().replace(/\/$/, '')
  return `${base}${path}`
}

function integrationIdentifier() {
  const suffix = crypto.randomBytes(8).toString('base64url').replace(/[^a-zA-Z]/g, '').slice(0, 8).padEnd(8, 'v')
  return `virla_service_${suffix}`
}

export function buildRecipientAccountParams(user) {
  return {
    contact_email: user.email,
    display_name: user.name,
    dashboard: 'express',
    identity: { country: 'BR' },
    defaults: {
      currency: 'brl',
      locales: ['pt-BR'],
      profile: { product_description: 'Serviços de cuidado prestados por profissional independente pela VIRLA.' },
      responsibilities: {
        fees_collector: 'application',
        losses_collector: 'application',
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: { stripe_transfers: { requested: true } },
        },
      },
    },
    metadata: { virlaUserId: user.id, virlaRole: 'CUIDADOR' },
    include: ['configuration.merchant', 'configuration.recipient', 'defaults', 'requirements'],
  }
}

export async function createRecipientAccount(user) {
  const stripe = getStripeClient()
  return stripe.v2.core.accounts.create(buildRecipientAccountParams(user))
}

export async function createRecipientOnboardingLink(accountId) {
  return getStripeClient().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: ['merchant', 'recipient'],
        collection_options: { fields: 'eventually_due', future_requirements: 'include' },
        refresh_url: frontendUrl('/perfil?stripe=refresh'),
        return_url: frontendUrl('/perfil?stripe=return'),
      },
    },
  })
}

export async function getRecipientAccountStatus(accountId) {
  const account = await getStripeClient().v2.core.accounts.retrieve(accountId, {
    include: ['configuration.merchant', 'configuration.recipient', 'requirements', 'future_requirements', 'defaults'],
  })
  const cardPaymentsStatus = account.configuration?.merchant?.capabilities?.card_payments?.status ?? 'pending'
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance
  const transferStatus = balance?.stripe_transfers?.status ?? 'pending'
  const payoutStatus = balance?.payouts?.status ?? 'pending'
  return {
    account,
    ready: cardPaymentsStatus === 'active' && transferStatus === 'active' && payoutStatus === 'active',
    cardPaymentsStatus,
    transferStatus,
    payoutStatus,
  }
}

export function buildCheckoutSessionParams({ report, familiar, connectedAccountId }) {
  return {
    mode: 'payment',
    locale: 'pt-BR',
    integration_identifier: integrationIdentifier(),
    client_reference_id: report.id,
    customer_email: familiar.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'brl',
        unit_amount: report.totalAmount,
        product_data: {
          name: 'Serviço de cuidado VIRLA',
          description: `Atendimento de ${report.serviceDate} — relatório confirmado e assinado`,
          metadata: { reportId: report.id, solicitacaoId: report.solicitacaoId },
        },
      },
    }],
    payment_intent_data: {
      on_behalf_of: connectedAccountId,
      transfer_data: { destination: connectedAccountId },
      metadata: {
        reportId: report.id,
        solicitacaoId: report.solicitacaoId,
        familiarId: report.familiarId,
        caregiverId: report.caregiverId,
      },
    },
    metadata: {
      reportId: report.id,
      solicitacaoId: report.solicitacaoId,
      familiarId: report.familiarId,
      caregiverId: report.caregiverId,
      reportHash: report.reportHash,
    },
    success_url: frontendUrl('/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: frontendUrl(`/solicitacoes?pagamento=cancelado&report_id=${encodeURIComponent(report.id)}`),
  }
}

export async function createCheckoutForSignedReport({ report, familiar, connectedAccountId, attempt = 1 }) {
  const stripe = getStripeClient()
  return stripe.checkout.sessions.create(
    buildCheckoutSessionParams({ report, familiar, connectedAccountId }),
    { idempotencyKey: `virla-report-${report.id}-${attempt}` },
  )
}

export async function refundDestinationPayment(paymentIntentId, reportId) {
  return getStripeClient().refunds.create({
    payment_intent: paymentIntentId,
    reverse_transfer: true,
    metadata: { reportId },
  }, { idempotencyKey: `virla-refund-${reportId}` })
}

export async function reverseDisputedTransfer(dispute) {
  const stripe = getStripeClient()
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
  if (!chargeId) return { reversed: false, reason: 'NO_CHARGE' }
  const charge = await stripe.charges.retrieve(chargeId)
  const transferId = typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.id
  const reportId = charge.metadata?.reportId ?? ''
  if (!transferId) return { reversed: false, reason: 'NO_TRANSFER', reportId }
  const transfer = await stripe.transfers.retrieve(transferId)
  const remaining = Math.max(0, transfer.amount - (transfer.amount_reversed ?? 0))
  const reversalAmount = Math.min(dispute.amount, remaining)
  if (reversalAmount === 0) return { reversed: false, reason: 'ALREADY_REVERSED', reportId }
  const reversal = await stripe.transfers.createReversal(transferId, {
    amount: reversalAmount,
    metadata: { disputeId: dispute.id, reportId },
  }, { idempotencyKey: `virla-dispute-${dispute.id}` })
  logger.warn('stripe:dispute_transfer_reversed', { disputeId: dispute.id, transferId, reversalId: reversal.id })
  return { reversed: true, reversal, reportId }
}
