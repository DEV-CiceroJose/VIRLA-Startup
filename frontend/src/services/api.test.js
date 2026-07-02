import { describe, it, expect, beforeEach, vi } from 'vitest'

const getIdTokenMock = vi.fn()
vi.mock('./auth', () => ({ getIdToken: (...a) => getIdTokenMock(...a) }))

import api from './api'

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
  beforeEach(() => vi.clearAllMocks())

  it('anexa Bearer com o ID token do Firebase', async () => {
    getIdTokenMock.mockResolvedValue('id-token-abc')
    const config = await requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer id-token-abc')
  })

  it('não anexa Authorization quando não há usuário logado', async () => {
    getIdTokenMock.mockResolvedValue(null)
    const config = await requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('api · interceptor de resposta', () => {
  beforeEach(() => vi.clearAllMocks())

  it('403 fora do login redireciona para /login', async () => {
    const assign = stubLocation('/home')
    await expect(
      responseRejected({ response: { status: 403 }, config: { url: '/users/1' } }),
    ).rejects.toBeTruthy()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  it('401 na tela de login NÃO redireciona', async () => {
    const assign = stubLocation('/login')
    await expect(
      responseRejected({ response: { status: 401 }, config: { url: '/users/me' } }),
    ).rejects.toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })

  it('erros não-401/403 são apenas repassados', async () => {
    const assign = stubLocation('/home')
    await expect(
      responseRejected({ response: { status: 500 }, config: { url: '/users/1' } }),
    ).rejects.toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })
})
