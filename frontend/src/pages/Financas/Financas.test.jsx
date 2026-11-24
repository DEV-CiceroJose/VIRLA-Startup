import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}))

import api from '../../services/api'
import Financas from './index'

const summary = {
  receivedCents: 68000,
  receivableCents: 28000,
  completedServices: 2,
  pendingServices: 1,
  hourlyRate: 45,
  entries: [
    { id: 'a', status: 'PAID', serviceDate: '2026-11-18', amountCents: 36000 },
    { id: 'b', status: 'SIGNED', serviceDate: '2026-11-21', amountCents: 28000 },
    { id: 'c', status: 'PAID', serviceDate: '2026-10-14', amountCents: 32000 },
    { id: 'd', status: 'REFUNDED', serviceDate: '2026-10-17', amountCents: 18000 },
  ],
}

const renderPage = () => render(<MemoryRouter><Financas /></MemoryRouter>)
const rows = () => screen.getAllByRole('listitem')

describe('Finanças do cuidador', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra o resumo e agrupa o histórico por mês, do mais recente ao mais antigo', async () => {
    api.get.mockResolvedValue({ data: summary })
    renderPage()

    expect(await screen.findByText('R$ 680,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 280,00', { selector: '.vf-figure' })).toBeInTheDocument()

    const months = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(months).toEqual(['Novembro de 2026', 'Outubro de 2026'])

    const november = screen.getByRole('region', { name: 'Novembro de 2026' })
    expect(within(november).getByText('R$ 360,00 recebidos')).toBeInTheDocument()
    expect(within(november).getByText('R$ 280,00 a receber')).toBeInTheDocument()
    expect(within(november).getAllByRole('listitem')[0]).toHaveTextContent('Aguardando pagamento')
  })

  it('filtra pelas abas Recebidos e A receber', async () => {
    api.get.mockResolvedValue({ data: summary })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('R$ 680,00')

    expect(rows()).toHaveLength(4)

    await user.click(screen.getByRole('tab', { name: /recebidos/i }))
    expect(rows()).toHaveLength(2)
    rows().forEach((row) => expect(row).toHaveTextContent('Recebido'))

    await user.click(screen.getByRole('tab', { name: /a receber/i }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Aguardando pagamento')
  })

  it('filtra por situação e oferece limpar quando nada sobra', async () => {
    api.get.mockResolvedValue({ data: summary })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('R$ 680,00')

    await user.selectOptions(screen.getByLabelText('Situação'), 'REFUNDED')
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Reembolsado')

    await user.click(screen.getByRole('tab', { name: /recebidos/i }))
    expect(screen.getByText('Nenhum atendimento com esses filtros')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0])
    expect(rows()).toHaveLength(2)
  })

  it('convida a buscar oportunidades quando ainda não há atendimentos', async () => {
    api.get.mockResolvedValue({ data: { ...summary, receivedCents: 0, receivableCents: 0, entries: [] } })
    renderPage()

    expect(await screen.findByText('Nenhum atendimento com relatório ainda')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver oportunidades/i })).toHaveAttribute('href', '/solicitacoes-disponiveis')
    expect(screen.queryByLabelText('Situação')).not.toBeInTheDocument()
  })

  it('explica o erro quando o resumo não carrega', async () => {
    api.get.mockRejectedValue(new Error('rede'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})
