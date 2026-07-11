import { describe, it, expect } from 'vitest'
import { notificationText, notificationHref } from './notificationsView'

describe('notificationText', () => {
  it('mensagem singular vs plural pelo count', () => {
    expect(notificationText({ type: 'MESSAGE', senderName: 'Ana', count: 1 })).toMatch(/Ana.*nova mensagem/)
    expect(notificationText({ type: 'MESSAGE', senderName: 'Ana', count: 3 })).toMatch(/Ana.*3 novas mensagens/)
  })

  it('eventos de solicitação incluem ator e título', () => {
    expect(notificationText({ type: 'SOLICITACAO_ASSUMIDA', actorName: 'João', solicitacaoTitulo: 'Cuidado' }))
      .toMatch(/João assumiu.*Cuidado/)
    expect(notificationText({ type: 'SOLICITACAO_CONCLUIDA', actorName: 'Maria', solicitacaoTitulo: 'Cuidado' }))
      .toMatch(/Maria concluiu.*Cuidado/)
    expect(notificationText({ type: 'SOLICITACAO_CANCELADA', actorName: 'Maria', solicitacaoTitulo: 'Cuidado' }))
      .toMatch(/Maria cancelou.*Cuidado/)
  })
})

describe('notificationHref', () => {
  it('mensagem aponta pro chat do remetente', () => {
    expect(notificationHref({ type: 'MESSAGE', senderId: 's1' })).toBe('/chat/s1')
  })
  it('assumida vai pra Solicitações do familiar', () => {
    expect(notificationHref({ type: 'SOLICITACAO_ASSUMIDA' })).toBe('/solicitacoes')
  })
  it('concluída/cancelada vão pras Solicitações do cuidador', () => {
    expect(notificationHref({ type: 'SOLICITACAO_CONCLUIDA' })).toBe('/solicitacoes-disponiveis')
    expect(notificationHref({ type: 'SOLICITACAO_CANCELADA' })).toBe('/solicitacoes-disponiveis')
  })
})
