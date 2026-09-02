import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateContractAmountCents,
  calculatePaymentDueDate,
  paymentIsDue,
} from '../src/utils/paymentSchedule.js'

test('calcula o relatório usando valor/hora e duração do contrato', () => {
  assert.equal(calculateContractAmountCents({ hourlyRate: 25, startedAt: '08:00', endedAt: '16:00' }), 20000)
  assert.equal(calculateContractAmountCents({ hourlyRate: 30, startedAt: '08:30', endedAt: '09:45' }), 3750)
  assert.equal(calculateContractAmountCents({ hourlyRate: 30, startedAt: '10:00', endedAt: '09:00' }), null)
})

test('define vencimentos diário, semanal e mensal a partir do início do contrato', () => {
  assert.equal(calculatePaymentDueDate({ contractStartDate: '2026-08-22', serviceDate: '2026-08-27', paymentRecurrence: 'DIARIA' }), '2026-08-27')
  assert.equal(calculatePaymentDueDate({ contractStartDate: '2026-08-22', serviceDate: '2026-08-27', paymentRecurrence: 'SEMANAL' }), '2026-08-29')
  assert.equal(calculatePaymentDueDate({ contractStartDate: '2026-08-22', serviceDate: '2026-08-29', paymentRecurrence: 'SEMANAL' }), '2026-08-29')
  assert.equal(calculatePaymentDueDate({ contractStartDate: '2026-07-31', serviceDate: '2026-08-27', paymentRecurrence: 'MENSAL' }), '2026-08-31')
  assert.equal(calculatePaymentDueDate({ contractStartDate: '2026-01-31', serviceDate: '2026-02-15', paymentRecurrence: 'MENSAL' }), '2026-02-28')
  assert.equal(calculatePaymentDueDate({ contractStartDate: '2026-01-31', serviceDate: '2026-02-28', paymentRecurrence: 'MENSAL' }), '2026-02-28')
})

test('bloqueia pagamento antes do vencimento', () => {
  assert.equal(paymentIsDue('2026-08-29', '2026-08-27'), false)
  assert.equal(paymentIsDue('2026-08-27', '2026-08-27'), true)
})
