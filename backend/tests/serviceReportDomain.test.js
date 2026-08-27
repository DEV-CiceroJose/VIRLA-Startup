import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertCheckoutEligible,
  canonicalReportSnapshot,
  createReportHash,
  hashAuditValue,
  ServiceReportError,
  signatureNameMatches,
} from '../src/services/serviceReportDomain.js'

const signedReportData = {
  id: 'report_abcdefghijklmnop',
  solicitacaoId: 'sol_abcdefghijklmnop',
  caregiverId: 'care_abcdefghijklmnop',
  familiarId: 'fam_abcdefghijklmnop',
  serviceDate: '2026-08-23',
  startedAt: '08:00',
  endedAt: '16:00',
  activities: 'Acompanhamento, alimentação e medicação conforme orientação.',
  observations: 'Dia tranquilo.',
  incidents: '',
  contractHourlyRate: 18.75,
  paymentRecurrence: 'DIARIA',
  paymentDueDate: '2026-08-23',
  baseAmount: 15000,
  platformFeeCents: 0,
  fixedFeeCents: 0,
  totalAmount: 15000,
  status: 'SIGNED',
  signature: { signedAt: new Date('2026-08-23T20:00:00Z') },
}
const signedReport = { ...signedReportData, reportHash: createReportHash(signedReportData) }

test('hash do relatório é determinístico e muda quando o conteúdo muda', () => {
  assert.equal(createReportHash(signedReport), createReportHash({ ...signedReport }))
  assert.notEqual(createReportHash(signedReport), createReportHash({ ...signedReport, activities: 'Conteúdo alterado' }))
  assert.match(createReportHash(signedReport), /^[a-f0-9]{64}$/)
  assert.ok(canonicalReportSnapshot(signedReport).includes('Acompanhamento'))
})

test('checkout só é elegível para o familiar dono após assinatura auditável', () => {
  assert.doesNotThrow(() => assertCheckoutEligible(signedReport, signedReport.familiarId))
  assert.throws(
    () => assertCheckoutEligible({ ...signedReport, status: 'PENDING_SIGNATURE' }, signedReport.familiarId),
    (err) => err instanceof ServiceReportError && err.code === 'REPORT_NOT_SIGNED' && err.statusCode === 409,
  )
  assert.throws(
    () => assertCheckoutEligible(signedReport, 'outro_abcdefghijkl'),
    (err) => err.code === 'REPORT_FORBIDDEN' && err.statusCode === 403,
  )
})

test('assinatura incompleta bloqueia o checkout', () => {
  assert.throws(
    () => assertCheckoutEligible({ ...signedReport, reportHash: null }, signedReport.familiarId),
    (err) => err.code === 'SIGNATURE_INVALID',
  )
})

test('alteração no conteúdo depois da assinatura bloqueia o checkout', () => {
  assert.throws(
    () => assertCheckoutEligible({ ...signedReport, activities: 'Conteúdo adulterado' }, signedReport.familiarId),
    (err) => err.code === 'REPORT_INTEGRITY_INVALID' && err.statusCode === 409,
  )
})

test('recorrência futura mantém o checkout bloqueado mesmo após a assinatura', () => {
  const futureData = { ...signedReportData, paymentDueDate: '2999-12-31' }
  const futureReport = { ...futureData, reportHash: createReportHash(futureData) }
  assert.throws(
    () => assertCheckoutEligible(futureReport, futureReport.familiarId),
    (err) => err.code === 'PAYMENT_NOT_DUE' && err.statusCode === 409,
  )
})

test('dados técnicos da assinatura são pseudonimizados com HMAC', () => {
  const first = hashAuditValue('203.0.113.10', 'segredo')
  const second = hashAuditValue('203.0.113.10', 'segredo')
  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.equal(hashAuditValue('203.0.113.10', ''), null)
})

test('nome digitado corresponde ao perfil ignorando acentos e espaços', () => {
  assert.equal(signatureNameMatches('  Maria   José da Silva ', 'Maria Jose da Silva'), true)
  assert.equal(signatureNameMatches('Outra Pessoa', 'Maria Jose da Silva'), false)
})
