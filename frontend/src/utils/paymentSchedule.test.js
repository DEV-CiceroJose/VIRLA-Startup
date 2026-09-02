import { describe, expect, it } from 'vitest'
import {
  calculateContractAmountCents,
  calculatePaymentDueDate,
  daysUntilPayment,
  paymentCountdownLabel,
} from './paymentSchedule'

describe('agenda de pagamento do contrato', () => {
  it('calcula o valor sem aceitar preço manual no relatório', () => {
    expect(calculateContractAmountCents({ hourlyRate: 25, startedAt: '08:00', endedAt: '16:00' })).toBe(20000)
  })

  it('calcula recorrências e contagem regressiva', () => {
    const due = calculatePaymentDueDate({ contractStartDate: '2026-08-22', serviceDate: '2026-08-27', paymentRecurrence: 'SEMANAL' })
    expect(due).toBe('2026-08-29')
    expect(daysUntilPayment(due, '2026-08-27')).toBe(2)
    expect(paymentCountdownLabel(due, '2026-08-27')).toBe('daqui a 2 dias')
  })

  it('limita o vencimento mensal ao último dia do mês', () => {
    expect(calculatePaymentDueDate({ contractStartDate: '2026-01-31', serviceDate: '2026-02-15', paymentRecurrence: 'MENSAL' })).toBe('2026-02-28')
  })
})
