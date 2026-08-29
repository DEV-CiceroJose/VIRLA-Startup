import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
}))

import Solicitacoes from './index'
import api from '../../services/api'

function renderPage() {
  return render(
    <MemoryRouter>
      <Solicitacoes />
    </MemoryRouter>,
  )
}

describe('Página Minhas Solicitações — form completo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('meuId', 'fam1')
    api.get.mockResolvedValue({ data: { solicitacoes: [] } })
    api.post.mockResolvedValue({ data: { solicitacao: {} } })
  })

  it('envia contrato e recorrência de pagamento no POST', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Nova/i }))

    await user.type(screen.getByLabelText(/Título/i), 'Cuidado para minha avó')
    await user.type(screen.getByLabelText(/Descrição/i), 'Preciso de cuidado durante o dia todo.')
    await user.type(screen.getByLabelText(/Cidade/i), 'Fortaleza')
    await user.click(screen.getByLabelText(/Estado/i))
    await user.click(screen.getByRole('option', { name: 'Ceará' }))
    await user.click(screen.getByLabelText(/Data de início/i))
    await user.click(screen.getByRole('button', { name: 'Em 7 dias' }))
    await user.click(screen.getByRole('button', { name: /Aplicar data/i }))
    await user.type(screen.getByLabelText(/Valor\/hora/i), '4500')
    await user.click(screen.getByLabelText(/Turno/i))
    await user.click(screen.getByRole('option', { name: 'Manhã' }))
    await user.click(screen.getByLabelText(/Frequência/i))
    await user.click(screen.getByRole('option', { name: 'Semanal' }))
    await user.click(screen.getByLabelText(/Recorrência do pagamento/i))
    await user.click(screen.getByRole('option', { name: 'Mensal' }))

    await user.click(screen.getByRole('button', { name: /Publicar solicitação/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    const [, body] = api.post.mock.calls[0]
    const start = new Date()
    start.setDate(start.getDate() + 7)
    const expectedStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    expect(body).toMatchObject({
      cidade: 'Fortaleza',
      estado: 'CE',
      dataInicio: expectedStart,
      valorHora: 45,
      turno: 'MANHA',
      frequencia: 'SEMANAL',
      paymentRecurrence: 'MENSAL',
    })
  })

  it('bloqueia o envio quando faltam campos obrigatórios (cidade/estado/início)', async () => {
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Nova/i }))

    await user.type(screen.getByLabelText(/Título/i), 'Cuidado para minha avó')
    await user.type(screen.getByLabelText(/Descrição/i), 'Preciso de cuidado durante o dia todo.')
    await user.click(screen.getByRole('button', { name: /Publicar solicitação/i }))

    expect(api.post).not.toHaveBeenCalled()
    expect(await screen.findByText(/cidade, estado, data de início, valor\/hora e recorrência/i)).toBeInTheDocument()
  })

  it('exibe dataInicio sem deslocamento de fuso (não perde um dia)', async () => {
    api.get.mockResolvedValue({
      data: {
        solicitacoes: [
          {
            id: 's1',
            titulo: 'Cuidado avó',
            descricao: 'desc',
            urgencia: 'BAIXA',
            tipoCuidado: [],
            status: 'ABERTA',
            cidade: 'Fortaleza',
            estado: 'CE',
            dataInicio: '2026-12-01',
            turno: 'MANHA',
            frequencia: 'SEMANAL',
            valorHora: 45,
            paymentRecurrence: 'SEMANAL',
            createdAt: '2026-07-01T12:00:00.000Z',
            viewedByIds: [],
            _count: { interessados: 0 },
          },
        ],
      },
    })

    renderPage()

    const inicio = await screen.findByText(
      (_, el) => el?.tagName === 'SPAN' && el.textContent.replace(/\s+/g, ' ').trim() === 'Início 01/12/2026',
    )
    expect(inicio).toBeInTheDocument()
    expect(
      screen.queryByText(
        (_, el) => el?.tagName === 'SPAN' && el.textContent.replace(/\s+/g, ' ').trim() === 'Início 30/11/2026',
      ),
    ).toBeNull()
  })
})
