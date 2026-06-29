import { describe, it, expect, beforeEach, vi } from 'vitest'
import api from './api'

// Acessa os handlers registrados nos interceptors do axios para exercitá-los
// diretamente, sem precisar de uma requisição HTTP real.
const requestFulfilled = api.interceptors.request.handlers[0].fulfilled
const responseRejected = api.interceptors.response.handlers[0].rejected

function stubLocation(pathname) {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, assign, href: `http://localhost${pathname}` },
  })
  return assign
}

describe('api · interceptor de requisição', () => {
  beforeEach(() => localStorage.clear())

  it('anexa Bearer token quando há sessão', () => {
    localStorage.setItem('meuToken', 'abc123')
    const config = requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('não anexa Authorization sem token', () => {
    const config = requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('api · interceptor de resposta (401)', () => {
  beforeEach(() => localStorage.clear())

  it('401 fora do login limpa o token e redireciona para /login', async () => {
    localStorage.setItem('meuToken', 'tok')
    const assign = stubLocation('/home')
    await expect(
      responseRejected({ response: { status: 401 }, config: { url: '/users/1' } }),
    ).rejects.toBeTruthy()
    expect(localStorage.getItem('meuToken')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  it('401 na tela de login NÃO desloga (erro fica no formulário)', async () => {
    localStorage.setItem('meuToken', 'tok')
    const assign = stubLocation('/login')
    await expect(
      responseRejected({ response: { status: 401 }, config: { url: '/auth/login' } }),
    ).rejects.toBeTruthy()
    expect(localStorage.getItem('meuToken')).toBe('tok')
    expect(assign).not.toHaveBeenCalled()
  })

  it('erros não-401 são apenas repassados', async () => {
    localStorage.setItem('meuToken', 'tok')
    const assign = stubLocation('/home')
    await expect(
      responseRejected({ response: { status: 500 }, config: { url: '/users/1' } }),
    ).rejects.toBeTruthy()
    expect(localStorage.getItem('meuToken')).toBe('tok')
    expect(assign).not.toHaveBeenCalled()
  })
})
