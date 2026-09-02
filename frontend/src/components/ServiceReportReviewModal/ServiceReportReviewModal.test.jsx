import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../../services/api'
import ServiceReportReviewModal from './index'

const solicitacao = { id: 'solicitacao1234567890', titulo: 'Cuidado diário' }
const pendingReport = {
  id: solicitacao.id,
  solicitacaoId: solicitacao.id,
  status: 'PENDING_SIGNATURE',
  serviceDate: '2026-08-23',
  startedAt: '08:00',
  endedAt: '16:00',
  activities: 'Alimentação, medicação e acompanhamento durante o dia.',
  observations: '',
  incidents: '',
  paymentRecurrence: 'DIARIA',
  paymentDueDate: '2026-08-23',
  totalAmount: 10000,
}

describe('Revisão e assinatura do relatório', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mantém o pagamento bloqueado enquanto o cuidador não envia relatório', async () => {
    api.get.mockResolvedValue({ data: { report: null } })
    render(<ServiceReportReviewModal solicitacao={solicitacao} onClose={() => {}} />)

    expect(await screen.findByText(/pagamento permanecerá bloqueado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pagar com stripe/i })).not.toBeInTheDocument()
  })

  it('exige os aceites e envia a assinatura antes de liberar o botão Stripe', async () => {
    const user = userEvent.setup({ delay: null })
    api.get.mockResolvedValue({ data: { report: pendingReport } })
    api.post.mockResolvedValue({ data: { report: { ...pendingReport, status: 'SIGNED', reportHash: 'hash' } } })
    render(<ServiceReportReviewModal solicitacao={solicitacao} onClose={() => {}} />)

    const signButton = await screen.findByRole('button', { name: /confirmar e assinar/i })
    expect(signButton).toBeDisabled()

    await user.click(screen.getByLabelText(/confirmo que o serviço foi prestado/i))
    await user.click(screen.getByLabelText(/aceito assinar eletronicamente/i))
    await user.type(screen.getByLabelText(/digite seu nome completo/i), 'Maria da Silva')
    await user.click(signButton)

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      `/service-reports/${pendingReport.id}/sign`,
      { accepted: true, declaration: true, typedName: 'Maria da Silva' },
    ))
    expect(await screen.findByRole('button', { name: /pagar com stripe/i })).toBeInTheDocument()
  })

  it('exibe o comprovante auditável depois da assinatura', async () => {
    api.get.mockResolvedValue({
      data: {
        report: {
          ...pendingReport,
          status: 'SIGNED',
          reportHash: 'a'.repeat(64),
          signature: {
            signedByName: 'Maria da Silva',
            signedAt: '2026-08-23T20:00:00.000Z',
          },
        },
      },
    })

    render(<ServiceReportReviewModal solicitacao={solicitacao} onClose={() => {}} />)

    expect(await screen.findByRole('region', { name: /comprovante da assinatura/i })).toHaveTextContent('Maria da Silva')
    expect(screen.getByText(/integridade:/i)).toHaveTextContent('a'.repeat(64))
  })

  it('mostra a previsão e mantém o Stripe bloqueado antes do vencimento', async () => {
    api.get.mockResolvedValue({
      data: {
        report: {
          ...pendingReport,
          status: 'SIGNED',
          paymentRecurrence: 'SEMANAL',
          paymentDueDate: '2999-12-31',
          reportHash: 'b'.repeat(64),
          signature: { signedByName: 'Maria da Silva', signedAt: '2026-08-23T20:00:00.000Z' },
        },
      },
    })

    render(<ServiceReportReviewModal solicitacao={solicitacao} onClose={() => {}} />)

    expect(await screen.findByText(/conforme o contrato, o pagamento ficará disponível/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pagar com stripe/i })).not.toBeInTheDocument()
  })
})
