import { describe, it, expect } from 'vitest'
import {
  upsertNotification,
  countUnread,
  markReadInList,
  markAllReadInList,
  markConversationReadInList,
} from './notificationsReducer'

const msg = (over = {}) => ({ id: 'm1', type: 'MESSAGE', senderId: 's1', read: false, count: 1, ...over })
const status = (over = {}) => ({ id: 'a1', type: 'SOLICITACAO_ASSUMIDA', read: false, ...over })

describe('upsertNotification', () => {
  it('colapsa mensagem do mesmo remetente não-lida, movendo para o topo', () => {
    const list = [msg({ id: 'm1', count: 1 }), status({ id: 'a1' })]
    const next = upsertNotification(list, msg({ id: 'm2', count: 2 }))
    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({ id: 'm2', senderId: 's1', count: 2 })
    expect(next.some((n) => n.id === 'm1')).toBe(false)
  })

  it('prepend quando é mensagem de outro remetente', () => {
    const list = [msg({ id: 'm1', senderId: 's1' })]
    const next = upsertNotification(list, msg({ id: 'm2', senderId: 's2' }))
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe('m2')
  })

  it('não colapsa numa mensagem já lida (cria linha nova no topo)', () => {
    const list = [msg({ id: 'm1', senderId: 's1', read: true })]
    const next = upsertNotification(list, msg({ id: 'm2', senderId: 's1' }))
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe('m2')
  })

  it('sempre prepend para eventos de status', () => {
    const list = [status({ id: 'a1' })]
    const next = upsertNotification(list, status({ id: 'a2', type: 'SOLICITACAO_CONCLUIDA' }))
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe('a2')
  })
})

describe('contagem e marcações', () => {
  it('countUnread conta só as não-lidas', () => {
    expect(countUnread([msg({ read: false }), status({ read: true })])).toBe(1)
  })

  it('markReadInList marca só o id alvo', () => {
    const out = markReadInList([msg({ id: 'm1' }), status({ id: 'a1' })], 'm1')
    expect(out.find((n) => n.id === 'm1').read).toBe(true)
    expect(out.find((n) => n.id === 'a1').read).toBe(false)
  })

  it('markAllReadInList marca todas', () => {
    const out = markAllReadInList([msg({ read: false }), status({ read: false })])
    expect(out.every((n) => n.read)).toBe(true)
  })

  it('markConversationReadInList marca só as MESSAGE do remetente', () => {
    const list = [msg({ id: 'm1', senderId: 's1' }), msg({ id: 'm2', senderId: 's2' }), status({ id: 'a1' })]
    const out = markConversationReadInList(list, 's1')
    expect(out.find((n) => n.id === 'm1').read).toBe(true)
    expect(out.find((n) => n.id === 'm2').read).toBe(false)
    expect(out.find((n) => n.id === 'a1').read).toBe(false)
  })
})
