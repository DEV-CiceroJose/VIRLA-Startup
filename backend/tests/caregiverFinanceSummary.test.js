import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeCaregiverReports } from '../src/services/caregiverFinanceSummary.js'

test('separa valores recebidos dos relatórios assinados ainda não pagos', () => {
  const result = summarizeCaregiverReports([
    { id: 'paid', status: 'PAID', baseAmount: 12000, serviceDate: '2026-11-20' },
    { id: 'due', status: 'SIGNED', baseAmount: 8000, serviceDate: '2026-11-21' },
    { id: 'checkout', status: 'PAYMENT_PENDING', baseAmount: 5000, serviceDate: '2026-11-22' },
    { id: 'unsigned', status: 'PENDING_SIGNATURE', baseAmount: 9000, serviceDate: '2026-11-23' },
    { id: 'refunded', status: 'REFUNDED', baseAmount: 3000, serviceDate: '2026-11-19' },
  ])

  assert.equal(result.receivedCents, 12000)
  assert.equal(result.receivableCents, 13000)
  assert.equal(result.completedServices, 1)
  assert.equal(result.pendingServices, 2)
  assert.equal(result.entries.length, 5)
})
