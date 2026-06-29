import { describe, it, expect, vi, afterEach } from 'vitest'

// O flag é lido no carregamento do módulo a partir de import.meta.env.
// Por isso usamos resetModules + stubEnv para testar os dois cenários.
describe('featureFlags · PAYMENT_ENABLED', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('fica DESLIGADO por padrão (sem a variável)', async () => {
    vi.resetModules()
    const { PAYMENT_ENABLED } = await import('./featureFlags')
    expect(PAYMENT_ENABLED).toBe(false)
  })

  it('só liga com VITE_ENABLE_PAYMENT === "true"', async () => {
    vi.stubEnv('VITE_ENABLE_PAYMENT', 'true')
    vi.resetModules()
    const { PAYMENT_ENABLED } = await import('./featureFlags')
    expect(PAYMENT_ENABLED).toBe(true)
  })

  it('qualquer outro valor mantém desligado', async () => {
    vi.stubEnv('VITE_ENABLE_PAYMENT', '1')
    vi.resetModules()
    const { PAYMENT_ENABLED } = await import('./featureFlags')
    expect(PAYMENT_ENABLED).toBe(false)
  })
})
