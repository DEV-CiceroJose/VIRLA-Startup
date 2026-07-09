import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock, useParams: () => ({ userId: 'bob' }) }
})
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn().mockResolvedValue({ data: {} }), delete: vi.fn() } }))
vi.mock('../../hooks/useFirebaseChat', () => ({
  useFirebaseChat: () => ({
    chatId: 'ana_bob', ready: true, realtimeActive: true,
    sendMessage: vi.fn(), markRead: vi.fn().mockResolvedValue(),
  }),
}))
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({ socket: { emit: vi.fn() }, emitTyping: vi.fn(), emitRead: vi.fn(), isConnected: true }),
}))
vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({ isRecording: false, startRecording: vi.fn(), stopRecording: vi.fn(), audioBlob: null, clearAudio: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

import Chat from './index'
import api from '../../services/api'

const NOW = Date.now()
const MINHA_RECENTE = { id: 'm1', senderId: 'ana', receiverId: 'bob', content: 'oi', createdAt: NOW, read: false }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('meuId', 'ana')
  localStorage.setItem('meuRole', 'FAMILIAR')
  api.get.mockImplementation((url) => {
    if (url.startsWith('/messages/history/')) {
      return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR' }, messages: [MINHA_RECENTE] } })
    }
    return Promise.resolve({ data: {} })
  })
})

function renderChat() {
  return render(<MemoryRouter><Chat /></MemoryRouter>)
}

describe('Chat — apagar mensagem', () => {
  it('mostra a lixeira na própria mensagem recente e apaga via api.delete', async () => {
    api.delete.mockResolvedValue({ data: { message: { ...MINHA_RECENTE, deleted: true, content: '' } } })
    const user = userEvent.setup()
    renderChat()

    const bubble = await screen.findByText('oi')
    await user.click(bubble) // revela a lixeira ao clicar na própria bolha
    const trash = await screen.findByRole('button', { name: /apagar mensagem/i })
    await user.click(trash)

    // ConfirmDialog abre
    const confirm = await screen.findByRole('button', { name: /^apagar$/i })
    await user.click(confirm)

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/messages/bob/m1'))
  })
})

describe('Chat — sair da conversa', () => {
  it('arquiva via api.patch e navega para a lista de conversas', async () => {
    api.patch.mockResolvedValue({ data: { msg: 'Conversa arquivada' } })
    const user = userEvent.setup()
    renderChat()

    await screen.findByText('oi') // conversa carregada
    await user.click(screen.getByRole('button', { name: /sair da conversa/i }))

    const confirm = await screen.findByRole('button', { name: /^sair$/i })
    await user.click(confirm)

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/conversations/bob/archive', { archived: true }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/home?tab=mensagens'))
  })
})
