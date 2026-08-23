import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCheckoutSessionParams, buildRecipientAccountParams, STRIPE_API_VERSION } from '../src/services/stripeService.js'

test('conta Connect usa Accounts v2 explícito para destinatário de marketplace', () => {
  const params = buildRecipientAccountParams({
    id: 'caregiver_1234567890',
    name: 'Cuidadora Teste',
    email: 'cuidadora@example.com',
  })
  assert.equal(STRIPE_API_VERSION, '2026-07-29.dahlia')
  assert.equal(params.dashboard, 'express')
  assert.equal(params.defaults.responsibilities.fees_collector, 'application')
  assert.equal(params.defaults.responsibilities.losses_collector, 'application')
  assert.equal(params.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested, true)
  assert.equal('merchant' in params.configuration, false)
  assert.equal('type' in params, false)
})

test('Checkout só descreve cobrança de destino e preserva o valor base do cuidador', () => {
  const report = {
    id: 'report_123456789012',
    solicitacaoId: 'sol_1234567890123456',
    familiarId: 'fam_1234567890123456',
    caregiverId: 'care_123456789012345',
    serviceDate: '2026-08-23',
    reportHash: 'a'.repeat(64),
    totalAmount: 10780,
    baseAmount: 10000,
  }
  const params = buildCheckoutSessionParams({
    report,
    familiar: { email: 'familiar@example.com' },
    connectedAccountId: 'acct_cuidador_teste',
  })
  assert.equal(params.mode, 'payment')
  assert.equal(params.line_items[0].price_data.currency, 'brl')
  assert.equal(params.line_items[0].price_data.unit_amount, 10780)
  assert.equal(params.payment_intent_data.application_fee_amount, 780)
  assert.equal(params.payment_intent_data.transfer_data.destination, 'acct_cuidador_teste')
  assert.equal(params.metadata.reportHash, report.reportHash)
  assert.equal('payment_method_types' in params, false)
  assert.match(params.integration_identifier, /^virla_service_[A-Za-z]{8}$/)
})

