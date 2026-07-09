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

describe('Chat — anexo (imagem/PDF)', () => {
  it('mostra preview ao escolher imagem e envia via POST /messages/attachment', async () => {
    api.post.mockResolvedValue({ data: { message: { id: 'a1', senderId: 'ana', receiverId: 'bob', attachmentType: 'image', attachmentUrl: '/uploads/x.png', attachmentName: 'x.png' } } })
    const user = userEvent.setup()
    renderChat()
    await screen.findByPlaceholderText('Digite uma mensagem…')

    const file = new File(['abc'], 'x.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, file)

    // Preview aparece com o nome + botão enviar.
    expect(await screen.findByText('x.png')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enviar anexo/i }))

    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/messages/attachment')
    expect(body).toBeInstanceOf(FormData)
  })

  it('rejeita arquivo acima de 5MB com toast, sem enviar', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderChat()
    await screen.findByPlaceholderText('Digite uma mensagem…')

    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, big)

    expect(toast.warning).toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('renderiza imagem recebida como <img> e PDF como link', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/messages/history/')) {
        return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR' }, messages: [
          { id: 'm1', senderId: 'bob', receiverId: 'ana', attachmentType: 'image', attachmentUrl: '/uploads/foto.png', attachmentName: 'foto.png', createdAt: Date.now() },
          { id: 'm2', senderId: 'bob', receiverId: 'ana', attachmentType: 'pdf', attachmentUrl: '/uploads/exame.pdf', attachmentName: 'exame.pdf', createdAt: Date.now() },
        ] } })
      }
      return Promise.resolve({ data: {} })
    })
    renderChat()

    const img = await screen.findByRole('img', { name: /foto\.png/i })
    expect(img.getAttribute('src')).toContain('/uploads/foto.png')
    const link = screen.getByRole('link', { name: /exame\.pdf/i })
    expect(link.getAttribute('href')).toContain('/uploads/exame.pdf')
  })
})
