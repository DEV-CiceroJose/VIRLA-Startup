import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/auth', () => ({
  loginWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  mapAuthError: (code) => (code === 'auth/invalid-credential' ? 'Credenciais inválidas.' : 'Erro.'),
}))
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import LoginPage from './index'
import { loginWithEmail, resetPassword } from '../../services/auth'
import api from '../../services/api'
import { toast } from 'sonner'

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

describe('Página de Login (Firebase)', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('renderiza e-mail, senha, Entrar, Google e "Esqueci minha senha"', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Sua senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /esqueci minha senha/i })).toBeInTheDocument()
  })

  it('e-mail inválido bloqueia o login', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'sem@dominio')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(toast.warning).toHaveBeenCalled()
    expect(loginWithEmail).not.toHaveBeenCalled()
  })

  it('login verificado navega para /home', async () => {
    loginWithEmail.mockResolvedValue({ emailVerified: true })
    api.get.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'segredo1')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/home'))
  })

  it('login sem e-mail verificado mostra o modal e não navega', async () => {
    loginWithEmail.mockResolvedValue({ emailVerified: false })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'segredo1')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(screen.getByText(/confirme seu e-mail/i)).toBeInTheDocument())
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('esqueci a senha com e-mail válido chama resetPassword', async () => {
    resetPassword.mockResolvedValue()
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('ana@provedor.com'))
  })
})
