import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

import api from '../../services/api'
import Feed from './index'

const caregiver = {
  id: 'caregiver1234567890',
  name: 'Ana Oliveira',
  role: 'CUIDADOR',
  hourlyRate: 40,
  specialties: ['ALZHEIMER_DEMENCIA'],
  match: {
    score: 90,
    level: 'EXCELENTE',
    reasons: [{ code: 'SAME_CITY', label: 'Atende na mesma cidade', points: 25 }],
    attention: [],
  },
}

describe('Feed com match inteligente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('meuId', 'familiar123456789')
    api.get.mockImplementation((url) => {
      if (url === '/users/familiar123456789') return Promise.resolve({ data: { user: { role: 'FAMILIAR' } } })
      if (url === '/solicitacoes/minhas') {
        return Promise.resolve({ data: { solicitacoes: [{ id: 'solicitacao1234567890', titulo: 'Cuidado Alzheimer', status: 'ABERTA' }] } })
      }
      if (url === '/users/familiar123456789/feed') {
        return Promise.resolve({ data: { users: [caregiver], totalPages: 1, matchContext: { id: 'solicitacao1234567890', titulo: 'Cuidado Alzheimer' } } })
      }
      return Promise.reject(new Error(`Rota inesperada: ${url}`))
    })
  })

  it('seleciona a solicitação ativa e apresenta o cuidador com explicação', async () => {
    render(<MemoryRouter><Feed /></MemoryRouter>)

    expect(await screen.findByText('Ana Oliveira')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: /compatibilidade de 90%/i })).toHaveTextContent('Atende na mesma cidade')
    expect(screen.getByLabelText(/match inteligente para/i)).toHaveValue('solicitacao1234567890')
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/users/familiar123456789/feed',
      { params: { page: 1, solicitacaoId: 'solicitacao1234567890' } },
    ))
  })
})
