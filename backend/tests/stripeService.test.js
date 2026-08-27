import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCheckoutSessionParams, buildRecipientAccountParams, STRIPE_API_VERSION } from '../src/services/stripeService.js'

test('conta Connect usa Accounts v2 com capacidades exigidas para destination charges', () => {
  const params = buildRecipientAccountParams({
    id: 'caregiver_1234567890',
    name: 'Cuidadora Teste',
    email: 'cuidadora@example.com',
  })
  assert.equal(STRIPE_API_VERSION, '2026-07-29.dahlia')
  assert.equal(params.dashboard, 'express')
  assert.equal(params.defaults.responsibilities.fees_collector, 'application')
  assert.equal(params.defaults.responsibilities.losses_collector, 'application')
  assert.equal(params.configuration.merchant.capabilities.card_payments.requested, true)
  assert.equal(params.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested, true)
  assert.deepEqual(params.include, ['configuration.merchant', 'configuration.recipient', 'defaults', 'requirements'])
  assert.equal('type' in params, false)
})

test('Checkout transfere o valor do contrato sem taxa de serviço da plataforma', () => {
  const report = {
    id: 'report_123456789012',
    solicitacaoId: 'sol_1234567890123456',
    familiarId: 'fam_1234567890123456',
    caregiverId: 'care_123456789012345',
    serviceDate: '2026-08-23',
    reportHash: 'a'.repeat(64),
    totalAmount: 10000,
    baseAmount: 10000,
  }
  const params = buildCheckoutSessionParams({
    report,
    familiar: { email: 'familiar@example.com' },
    connectedAccountId: 'acct_cuidador_teste',
  })
  assert.equal(params.mode, 'payment')
  assert.equal(params.line_items[0].price_data.currency, 'brl')
  assert.equal(params.line_items[0].price_data.unit_amount, 10000)
  assert.equal('application_fee_amount' in params.payment_intent_data, false)
  assert.equal(params.payment_intent_data.on_behalf_of, 'acct_cuidador_teste')
  assert.equal(params.payment_intent_data.transfer_data.destination, 'acct_cuidador_teste')
  assert.equal(params.metadata.reportHash, report.reportHash)
  assert.equal('payment_method_types' in params, false)
  assert.match(params.integration_identifier, /^virla_service_[A-Za-z]{8}$/)
})
