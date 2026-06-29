import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))
// Upload de imagem usa FileReader/canvas — fora do escopo deste fluxo.
vi.mock('../../components/ProfileImageUpload', () => ({ default: () => null }))

import Cadastro from './index'
import api from '../../services/api'
import { toast } from 'sonner'

function renderCadastro() {
  return render(
    <MemoryRouter>
      <Cadastro />
    </MemoryRouter>,
  )
}

describe('Página de Cadastro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // Guarda anti-regressão da TELA BRANCA: se o componente quebrar ao montar
  // (ex.: erro de hook por React duplicado), este render falha.
  it('renderiza o formulário completo sem quebrar', () => {
    renderCadastro()
    expect(screen.getByRole('heading', { name: 'Cadastro' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nome completo')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument()
  })

  it('mostra o campo CRM/CRF só para Cuidador', async () => {
    const user = userEvent.setup()
    renderCadastro()
    // padrão = CUIDADOR → campo CRM presente
    expect(screen.getByPlaceholderText('Número do conselho')).toBeInTheDocument()
    // troca para FAMILIAR → campo some
    await user.selectOptions(screen.getByLabelText('Tipo de conta'), 'FAMILIAR')
    expect(screen.queryByPlaceholderText('Número do conselho')).not.toBeInTheDocument()
  })

  it('bloqueia envio com CPF inválido e avisa', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await user.type(screen.getByPlaceholderText('Nome completo'), 'Ana Souza')
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('000.000.000-00'), '11111111111')
    await user.type(screen.getByPlaceholderText(/Senha/i), 'segredo1')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))
    expect(toast.warning).toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('cadastro válido envia para /users e navega para /login', async () => {
    api.post.mockResolvedValue({ data: { user: { id: 'u9' } } })
    const user = userEvent.setup()
    renderCadastro()
    await user.type(screen.getByPlaceholderText('Nome completo'), 'Ana Souza')
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('000.000.000-00'), '52998224725')
    await user.type(screen.getByPlaceholderText(/Senha/i), 'segredo1')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    const [url, payload] = api.post.mock.calls[0]
    expect(url).toBe('/users')
    expect(payload).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@provedor.com',
      cpf: '52998224725',
      role: 'CUIDADOR',
    })
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })
})
