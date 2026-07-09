import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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
vi.mock('../../hooks/usePresence', () => ({ usePeerPresence: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

import Chat from './index'
import api from '../../services/api'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('meuId', 'ana')
  localStorage.setItem('meuRole', 'FAMILIAR')
  // jsdom não implementa URL.createObjectURL (usado no preview de imagem do anexo).
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  api.get.mockImplementation((url) => {
    if (url.startsWith('/messages/history/')) {
      return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR' }, messages: [] } })
    }
    return Promise.resolve({ data: {} })
  })
})

function renderChat() {
  return render(<MemoryRouter><Chat /></MemoryRouter>)
}

describe('Chat — emojis no composer', () => {
  it('insere o emoji escolhido no textarea', async () => {
    const user = userEvent.setup()
    renderChat()
    const textarea = await screen.findByPlaceholderText('Digite uma mensagem…')
    await user.type(textarea, 'oi ')

    await user.click(screen.getByRole('button', { name: /emojis/i }))
    await user.click(await screen.findByRole('button', { name: '😀' }))

    expect(textarea).toHaveValue('oi 😀')
  })
})
