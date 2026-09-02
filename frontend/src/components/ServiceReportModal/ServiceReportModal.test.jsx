import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ServiceReportModal from './index'

function dateFromToday(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

describe('Preenchimento do relatório diário', () => {
  it('bloqueia o relatório com uma mensagem clara quando o contrato ainda não começou', () => {
    render(
      <ServiceReportModal
        solicitacao={{
          id: 'solicitacao-futura',
          titulo: 'Acompanhamento futuro',
          dataInicio: dateFromToday(1),
          valorHora: 30,
          paymentRecurrence: 'DIARIA',
        }}
        apiClient={{ post: vi.fn() }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/o contrato começa em/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/data do serviço/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /enviar para assinatura/i })).toBeDisabled()
    expect(screen.queryByText(/data mínima/i)).not.toBeInTheDocument()
  })
})
