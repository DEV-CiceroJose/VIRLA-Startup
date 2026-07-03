import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }))
vi.mock('../../services/auth', () => ({
  registerWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  mapAuthError: vi.fn(() => ''),
  getIdToken: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))
// Upload de imagem usa FileReader/canvas — fora do escopo deste fluxo.
vi.mock('../../components/ProfileImageUpload', () => ({ default: () => null }))

import Cadastro from './index'
import api from '../../services/api'
import { registerWithEmail, loginWithGoogle, getIdToken } from '../../services/auth'
import { toast } from 'sonner'

function renderCadastro() {
  return render(
    <MemoryRouter>
      <Cadastro />
    </MemoryRouter>,
  )
}

async function fillValidFormExceptPasswords(user) {
  await user.type(screen.getByPlaceholderText('Nome completo'), 'Ana Souza')
  await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
  await user.type(screen.getByPlaceholderText('000.000.000-00'), '52998224725')
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
    expect(screen.getByPlaceholderText('Repita a senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cadastrar com google/i })).toBeInTheDocument()
  })

  it('mostra o select de Conselho e o número do registro só para Cuidador', async () => {
    const user = userEvent.setup()
    renderCadastro()
    // padrão = CUIDADOR → campos de conselho presentes
    expect(screen.getByLabelText('Conselho')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Número do registro')).toBeInTheDocument()
    // troca para FAMILIAR → campos somem
    await user.selectOptions(screen.getByLabelText('Tipo de conta'), 'FAMILIAR')
    expect(screen.queryByLabelText('Conselho')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Número do registro')).not.toBeInTheDocument()
  })

  it('bloqueia envio quando só o conselho ou só o número do registro for preenchido', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await fillValidFormExceptPasswords(user)
    await user.type(screen.getByPlaceholderText('Senha (mín. 6 caracteres)'), 'segredo1')
    await user.type(screen.getByPlaceholderText('Repita a senha'), 'segredo1')
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '1994-05-10' } })
    await user.selectOptions(screen.getByLabelText('Conselho'), 'COREN')
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(toast.warning).toHaveBeenCalledWith(
      'Informe o conselho e o número do registro (ou deixe ambos em branco).',
    )
    expect(registerWithEmail).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('bloqueia envio com CPF inválido e avisa', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await user.type(screen.getByPlaceholderText('Nome completo'), 'Ana Souza')
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('000.000.000-00'), '11111111111')
    await user.type(screen.getByPlaceholderText('Senha (mín. 6 caracteres)'), 'segredo1')
    await user.type(screen.getByPlaceholderText('Repita a senha'), 'segredo1')
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '1994-05-10' } })
    await user.click(screen.getByRole('button', { name: /criar conta/i }))
    expect(toast.warning).toHaveBeenCalled()
    expect(registerWithEmail).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('bloqueia envio com senhas divergentes e avisa', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await fillValidFormExceptPasswords(user)
    await user.type(screen.getByPlaceholderText('Senha (mín. 6 caracteres)'), 'segredo1')
    await user.type(screen.getByPlaceholderText('Repita a senha'), 'segredo2')
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: '1994-05-10' } })
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(toast.warning).toHaveBeenCalledWith('As senhas não conferem.')
    expect(registerWithEmail).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('cadastro válido cria credencial no Firebase, envia perfil sem senha e navega para /login', async () => {
    registerWithEmail.mockResolvedValue({ uid: 'u9' })
    api.post.mockResolvedValue({ data: { user: { id: 'u9' } } })
    getIdToken.mockResolvedValue('token')
    const user = userEvent.setup()
    renderCadastro()
    await fillValidFormExceptPasswords(user)
    await user.type(screen.getByPlaceholderText('Senha (mín. 6 caracteres)'), 'segredo1')
    await user.type(screen.getByPlaceholderText('Repita a senha'), 'segredo1')
    // data de nascimento (adulto) — o campo type="date" aceita 'YYYY-MM-DD'
    const dateInput = document.querySelector('input[type="date"]')
    fireEvent.change(dateInput, { target: { value: '1994-05-10' } })
    await user.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => expect(registerWithEmail).toHaveBeenCalledWith('ana@provedor.com', 'segredo1'))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    const [url, payload] = api.post.mock.calls[0]
    expect(url).toBe('/users')
    expect(payload).toMatchObject({
      name: 'Ana Souza',
      cpf: '52998224725',
      role: 'CUIDADOR',
      birthDate: '1994-05-10',
    })
    expect(payload).not.toHaveProperty('password')
    expect(payload).not.toHaveProperty('email')
    expect(getIdToken).toHaveBeenCalledWith(true)
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('cadastro com Google chama loginWithGoogle e navega para completar cadastro', async () => {
    loginWithGoogle.mockResolvedValue({ uid: 'g1' })
    const user = userEvent.setup()
    renderCadastro()
    await user.click(screen.getByRole('button', { name: /cadastrar com google/i }))

    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledTimes(1))
    expect(navigateMock).toHaveBeenCalledWith('/completar-cadastro')
  })
})
