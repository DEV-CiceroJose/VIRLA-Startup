import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  availableShifts: [],
  serviceFrequencies: [],
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
    await user.click(screen.getByLabelText('Conselho profissional'))
    await user.click(screen.getByRole('option', { name: /COREN/ }))
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

  it('estado (UF) usa o seletor visual com as 27 opções', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    const select = await screen.findByLabelText('Estado (UF)')
    expect(select).toHaveAttribute('role', 'combobox')
    await user.click(select)
    expect(screen.getByRole('option', { name: 'Pernambuco' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(28)
  })

  it('mostra e envia o valor por hora com máscara de moeda', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    api.put.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    // toLocaleString('pt-BR', {style:'currency',...}) pode usar espaço normal
    // ou non-breaking space (U+00A0) dependendo do ICU do runtime — normaliza
    // antes de comparar pra não depender de qual dos dois o Node usa.
    const normalize = (v) => v.replace(/\u00A0/g, ' ')
    const hourlyInput = await screen.findByLabelText('Valor por hora (R$)')
    expect(normalize(hourlyInput.value)).toBe('R$ 25,00')

    await user.clear(hourlyInput)
    await user.type(hourlyInput, '3000')
    expect(normalize(hourlyInput.value)).toBe('R$ 30,00')

    await user.click(screen.getByRole('button', { name: /salvar altera/i }))
    await screen.findByText('Perfil atualizado com sucesso!')
    const [, payload] = api.put.mock.calls[0]
    expect(payload.hourlyRate).toBe(30)
  })

  it('especialidades: mostra os chips e envia como array de values', async () => {
    api.get.mockResolvedValue({ data: { user: { ...CUIDADOR, specialties: ['IDOSOS'] } } })
    api.put.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    await screen.findByLabelText('Nome completo')

    expect(screen.getByRole('button', { name: 'Idosos' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Diabetes' }))

    await user.click(screen.getByRole('button', { name: /salvar altera/i }))
    await screen.findByText('Perfil atualizado com sucesso!')
    const [, payload] = api.put.mock.calls[0]
    expect(payload.specialties.sort()).toEqual(['DIABETES', 'IDOSOS'])
  })

  it('especialidades gravadas fora da lista fixa (dado legado) não aparecem pré-marcadas', async () => {
    api.get.mockResolvedValue({ data: { user: { ...CUIDADOR, specialties: ['Cuidado com idosos (texto livre antigo)'] } } })
    renderPerfil()
    await screen.findByLabelText('Nome completo')
    const buttons = screen.queryAllByRole('button', { pressed: true })
    expect(buttons).toHaveLength(0)
  })

  it('disponibilidade: envia turnos e frequências usados pelo match', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    api.put.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    await screen.findByLabelText('Nome completo')

    await user.click(screen.getByRole('button', { name: 'Manhã' }))
    await user.click(screen.getByRole('button', { name: 'Semanal' }))
    await user.click(screen.getByRole('button', { name: /salvar altera/i }))
    await screen.findByText('Perfil atualizado com sucesso!')

    const [, payload] = api.put.mock.calls[0]
    expect(payload.availableShifts).toEqual(['MANHA'])
    expect(payload.serviceFrequencies).toEqual(['SEMANAL'])
  })

  it('bio: mostra contador de caracteres e vira erro visual acima de 1900', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    renderPerfil()
    const bioInput = await screen.findByLabelText('Bio / Apresentação')
    expect(screen.getByText('9/2000')).toBeInTheDocument() // 'Sobre mim' tem 9 caracteres

    // fireEvent.change define o valor de uma vez (1 render) em vez de digitar
    // 1901 teclas uma a uma (userEvent.type re-renderiza o form inteiro por
    // tecla, ~30s). Mesma asserção: dispara o onChange controlado da bio.
    fireEvent.change(bioInput, { target: { value: 'a'.repeat(1901) } })
    expect(screen.getByText('1901/2000')).toBeInTheDocument()
    expect(screen.getByText('1901/2000')).toHaveClass('text-red-600')
  })

  it('mostra a barra de perfil incompleto quando faltam campos', async () => {
    api.get.mockResolvedValue({
      data: { user: { ...CUIDADOR, hourlyRate: null, description: '' } },
    })
    renderPerfil()
    await screen.findByLabelText('Nome completo')
    expect(screen.getByText(/perfil \d+% completo/i)).toBeInTheDocument()
  })
})
