import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupCep } from './viacep'

describe('lookupCep', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devolve city/state em sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ localidade: 'Recife', uf: 'PE' }),
    }))
    expect(await lookupCep('50030-230')).toEqual({ city: 'Recife', state: 'PE' })
  })

  it('devolve null quando o ViaCEP responde erro:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ erro: true }),
    }))
    expect(await lookupCep('00000000')).toBe(null)
  })

  it('devolve null em falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await lookupCep('50030230')).toBe(null)
  })

  it('devolve null se a resposta HTTP não for ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await lookupCep('50030230')).toBe(null)
  })

  it('devolve null sem chamar fetch se o CEP não tem 8 dígitos', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await lookupCep('123')).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
