import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// navigateMock precisa ser estável entre renders (mesmo padrão de
// Cadastro.test.jsx / Login.test.jsx): `useNavigate: () => vi.fn()` cria uma
// função nova a cada chamada, o que muda a identidade de `navigate` (e de
// `fetchHistory`, que depende dele) a cada render — o useEffect inicial do
// Chat depende de `navigate`/`fetchHistory` e sempre chama setState, então
// isso gera um loop infinito de render/effect (trava e estoura a heap).
const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock, useParams: () => ({ userId: 'bob' }) }
})
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn().mockResolvedValue({ data: {} }), delete: vi.fn() } }))
vi.mock('../../hooks/useFirebaseChat', () => ({
  useFirebaseChat: () => ({ chatId: 'ana_bob', ready: true, realtimeActive: true, sendMessage: vi.fn(), markRead: vi.fn().mockResolvedValue() }),
}))
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({ socket: { emit: vi.fn() }, emitTyping: vi.fn(), emitRead: vi.fn(), isConnected: true }),
}))
vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({ isRecording: false, startRecording: vi.fn(), stopRecording: vi.fn(), audioBlob: null, clearAudio: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

// Controla o retorno de usePeerPresence por teste.
const presenceMock = vi.fn()
vi.mock('../../hooks/usePresence', () => ({ usePeerPresence: () => presenceMock() }))

import Chat from './index'
import api from '../../services/api'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('meuId', 'ana')
  localStorage.setItem('meuRole', 'FAMILIAR')
  api.get.mockImplementation((url) => {
    if (url.startsWith('/messages/history/')) {
      return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR', approach: 'Home care' }, messages: [] } })
    }
    return Promise.resolve({ data: {} })
  })
})

function renderChat() {
  return render(<MemoryRouter><Chat /></MemoryRouter>)
}

describe('Chat — presença no header', () => {
  it('mostra "online" quando o peer está online', async () => {
    presenceMock.mockReturnValue({ state: 'online', lastChanged: Date.now() })
    renderChat()
    expect(await screen.findByText('online')).toBeInTheDocument()
  })

  it('mostra "visto por último" quando offline', async () => {
    presenceMock.mockReturnValue({ state: 'offline', lastChanged: Date.now() - 5 * 60_000 })
    renderChat()
    expect(await screen.findByText(/visto por último há 5 min/i)).toBeInTheDocument()
  })

  it('cai no subtítulo de papel/approach quando não há presença', async () => {
    presenceMock.mockReturnValue(null)
    renderChat()
    expect(await screen.findByText('Home care')).toBeInTheDocument()
  })
})
