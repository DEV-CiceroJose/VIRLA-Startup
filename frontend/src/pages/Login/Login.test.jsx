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

import LoginPage from './index'
import api from '../../services/api'
import { toast } from 'sonner'

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('Página de Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renderiza o formulário (e-mail, senha, botão Entrar)', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Sua senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('bloqueia envio com e-mail inválido e avisa o usuário', async () => {
    const user = userEvent.setup()
    renderLogin()
    // 'sem@dominio' passa na validação frouxa do <input type=email> do browser
    // (para o form enviar), mas falha na nossa isValidEmail (domínio sem ponto).
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'sem@dominio')
    await user.click(screen.getByRole('button', { name: /entrar/i }))
    expect(toast.warning).toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('login válido salva o token e navega para /home', async () => {
    api.post.mockResolvedValue({
      data: { token: 'jwt-xyz', user: { id: 'u1', name: 'Ana', role: 'FAMILIAR' } },
    })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'segredo1')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'ana@provedor.com',
        password: 'segredo1',
      }),
    )
    expect(localStorage.getItem('meuToken')).toBe('jwt-xyz')
    expect(localStorage.getItem('meuId')).toBe('u1')
    expect(navigateMock).toHaveBeenCalledWith('/home')
  })

  it('credenciais erradas mostram erro e não navegam', async () => {
    api.post.mockRejectedValue({ response: { status: 401 } })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'errada')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(navigateMock).not.toHaveBeenCalled()
    expect(localStorage.getItem('meuToken')).toBeNull()
  })
})
