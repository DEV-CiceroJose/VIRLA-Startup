import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../services/auth', () => ({
  hasPasswordProvider: vi.fn(() => true),
  linkPassword: vi.fn(),
  mapAuthError: vi.fn(() => ''),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('../../components/ProfileImageUpload', () => ({ default: () => null }))
vi.mock('../../services/viacep', () => ({ lookupCep: vi.fn() }))

import Perfil from './index'
import api from '../../services/api'
import { lookupCep } from '../../services/viacep'

const CUIDADOR = {
  id: 'u1',
  name: 'Ana Souza',
  email: 'ana@provedor.com',
  role: 'CUIDADOR',
  birthDate: '1994-05-10',
  bio: 'Sobre mim',
  profileImage: '',
  hourlyRate: 25,
  council: '',
  registerNumber: '',
  approach: '',
  specialties: [],
  description: '',
  zipCode: '',
  city: '',
  state: '',
}

function renderPerfil() {
  return render(
    <MemoryRouter>
      <Perfil />
    </MemoryRouter>,
  )
}

describe('Página de Perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('meuId', 'u1')
  })

  it('carrega e mostra os campos com labels associadas (Field do design system)', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    renderPerfil()
    expect(await screen.findByLabelText('Nome completo')).toHaveValue('Ana Souza')
    expect(screen.getByLabelText('Bio / Apresentação')).toHaveValue('Sobre mim')
    expect(screen.getByLabelText('Cidade')).toBeInTheDocument()
    expect(screen.getByLabelText('Estado (UF)')).toBeInTheDocument()
    expect(screen.getByLabelText('Conselho profissional')).toBeInTheDocument()
    expect(screen.getByLabelText('Registro profissional (COREN, CRP, etc.)')).toBeInTheDocument()
  })

  it('mostra o erro de par conselho/registro no campo, não no banner genérico', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    await screen.findByLabelText('Nome completo')
    await user.selectOptions(screen.getByLabelText('Conselho profissional'), 'COREN')
    await user.click(screen.getByRole('button', { name: /salvar altera/i }))

    expect(await screen.findByText('Informe o conselho e o número do registro.')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('salva o perfil com sucesso', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    api.put.mockResolvedValue({ data: { user: { ...CUIDADOR, name: 'Ana Nova' } } })
    const user = userEvent.setup()
    renderPerfil()
    const nameInput = await screen.findByLabelText('Nome completo')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ana Nova')
    await user.click(screen.getByRole('button', { name: /salvar altera/i }))

    expect(await screen.findByText('Perfil atualizado com sucesso!')).toBeInTheDocument()
    expect(api.put).toHaveBeenCalledTimes(1)
  })

  it('autopreenche cidade/estado ao digitar um CEP válido', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    lookupCep.mockResolvedValue({ city: 'Recife', state: 'PE' })
    const user = userEvent.setup()
    renderPerfil()
    const cepInput = await screen.findByLabelText('CEP')
    await user.type(cepInput, '50030230')

    expect(await screen.findByDisplayValue('Recife')).toBeInTheDocument()
    expect(screen.getByLabelText('Estado (UF)')).toHaveValue('PE')
    expect(lookupCep).toHaveBeenCalledWith('50030230')
  })

  it('estado (UF) é um select com as 27 opções', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    renderPerfil()
    const select = await screen.findByLabelText('Estado (UF)')
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'Pernambuco' })).toBeInTheDocument()
  })
})
