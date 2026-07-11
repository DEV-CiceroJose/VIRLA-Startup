import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})

const ctx = {
  notifications: [],
  unreadCount: 0,
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ctx,
}))

import NotificationBell from './index'

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.notifications = []
    ctx.unreadCount = 0
  })

  it('mostra o badge com a contagem de não-lidas', () => {
    ctx.unreadCount = 3
    renderBell()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('não mostra badge quando não há não-lidas', () => {
    ctx.unreadCount = 0
    renderBell()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('ao abrir, lista as notificações e "marcar todas" chama a ação', async () => {
    const user = userEvent.setup({ delay: null })
    ctx.unreadCount = 1
    ctx.notifications = [
      { id: 'a1', type: 'SOLICITACAO_ASSUMIDA', actorName: 'João', solicitacaoTitulo: 'Cuidado', read: false },
    ]
    renderBell()
    await user.click(screen.getByRole('button', { name: /notifica/i }))
    expect(screen.getByText(/João assumiu.*Cuidado/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /marcar todas como lidas/i }))
    expect(ctx.markAllRead).toHaveBeenCalledTimes(1)
  })

  it('clicar numa notificação marca lida e navega', async () => {
    const user = userEvent.setup({ delay: null })
    ctx.unreadCount = 1
    ctx.notifications = [
      { id: 'm1', type: 'MESSAGE', senderId: 's1', senderName: 'Ana', count: 2, read: false },
    ]
    renderBell()
    await user.click(screen.getByRole('button', { name: /notifica/i }))
    await user.click(screen.getByText(/Ana.*2 novas mensagens/))
    expect(ctx.markRead).toHaveBeenCalledWith('m1')
    expect(navigateMock).toHaveBeenCalledWith('/chat/s1')
  })

  it('mostra estado vazio quando não há notificações', async () => {
    const user = userEvent.setup({ delay: null })
    renderBell()
    await user.click(screen.getByRole('button', { name: /notifica/i }))
    expect(screen.getByText(/nenhuma notificação/i)).toBeInTheDocument()
  })
})
