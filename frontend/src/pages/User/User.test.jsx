import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}))

const auth = { profile: { id: 'me', role: 'FAMILIAR' } }
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => auth,
}))

import api from '../../services/api'
import User from './index'

const caregiver = {
  id: 'c1',
  name: 'Marina Albuquerque',
  role: 'CUIDADOR',
  hourlyRate: 45,
  city: 'Recife',
  state: 'PE',
  council: 'COREN',
  registerNumber: 'PE-482913',
  specialties: ['IDOSOS', 'PARKINSON'],
  availableShifts: ['MANHA'],
  serviceFrequencies: ['SEMANAL'],
  description: 'Técnica de enfermagem há 9 anos.',
  approach: 'Registro tudo no relatório do dia.',
}

const renderAt = (id) => render(
  <MemoryRouter initialEntries={[`/user/${id}`]}>
    <Routes>
      <Route path="/user/:userId" element={<User />} />
    </Routes>
  </MemoryRouter>,
)

describe('Perfil público', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('meuId', 'me')
    auth.profile = { id: 'me', role: 'FAMILIAR' }
  })

  it('mostra identidade, verificação e ação de conversar do cuidador', async () => {
    api.get.mockResolvedValue({ data: { user: caregiver } })
    renderAt('c1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Marina Albuquerque' })).toBeInTheDocument()
    expect(screen.getByText('R$ 45,00/h')).toBeInTheDocument()
    expect(screen.getByText('Recife, PE')).toBeInTheDocument()
    expect(screen.getByText('COREN PE-482913')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /conversar com marina/i })).toHaveAttribute('href', '/chat/c1')
    expect(screen.getByText('Parkinson')).toBeInTheDocument()
    expect(screen.getByText('Manhã')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Como Marina trabalha' })).toBeInTheDocument()
  })

  it('oferece publicar solicitação só para familiares', async () => {
    api.get.mockResolvedValue({ data: { user: caregiver } })
    const { unmount } = renderAt('c1')
    expect(await screen.findByRole('link', { name: /publicar solicitação/i })).toHaveAttribute('href', '/solicitacoes')
    expect(screen.getByRole('link', { name: /buscar cuidadores/i })).toHaveAttribute('href', '/feed')
    unmount()

    auth.profile = { id: 'me', role: 'CUIDADOR' }
    renderAt('c1')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: /publicar solicitação/i })).not.toBeInTheDocument()
  })

  it('usa as iniciais quando não há foto e avisa quando falta registro', async () => {
    api.get.mockResolvedValue({ data: { user: { id: 'c2', name: 'Caio Henrique dos Santos', role: 'CUIDADOR' } } })
    renderAt('c2')

    expect(await screen.findByText('CS')).toBeInTheDocument()
    expect(screen.getByText('Ainda não informado')).toBeInTheDocument()
    expect(screen.getByText('Caio ainda não escreveu uma apresentação.')).toBeInTheDocument()
  })

  it('explica quando o perfil não carrega', async () => {
    api.get.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt('x')

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar este perfil.')
  })
})
