import { describe, it, expect } from 'vitest'
import { canDeleteMessage, mergeMessageById, DELETE_WINDOW_MS } from './chatMessages'

const NOW = 1_800_000_000_000

describe('canDeleteMessage', () => {
  const base = { id: 'm1', senderId: 'ana', createdAt: NOW, deleted: false }

  it('permite apagar a própria mensagem dentro da janela', () => {
    expect(canDeleteMessage(base, 'ana', NOW)).toBe(true)
    expect(canDeleteMessage(base, 'ana', NOW + DELETE_WINDOW_MS)).toBe(true)
  })
  it('bloqueia fora da janela', () => {
    expect(canDeleteMessage(base, 'ana', NOW + DELETE_WINDOW_MS + 1)).toBe(false)
  })
  it('bloqueia mensagem de outra pessoa', () => {
    expect(canDeleteMessage(base, 'bob', NOW)).toBe(false)
  })
  it('bloqueia mensagem já apagada', () => {
    expect(canDeleteMessage({ ...base, deleted: true }, 'ana', NOW)).toBe(false)
  })
  it('bloqueia mensagem otimista (sem id real)', () => {
    expect(canDeleteMessage({ ...base, _optimistic: true }, 'ana', NOW)).toBe(false)
  })
})

describe('mergeMessageById', () => {
  it('substitui a mensagem de mesmo id, mesclando campos', () => {
    const msgs = [{ id: 'a', content: 'oi', read: false }, { id: 'b', content: 'ola' }]
    const out = mergeMessageById(msgs, { id: 'a', deleted: true, content: '' })
    expect(out[0]).toEqual({ id: 'a', content: '', read: false, deleted: true })
    expect(out[1]).toBe(msgs[1]) // outros itens intactos
  })
  it('devolve a lista inalterada se o id não existir', () => {
    const msgs = [{ id: 'a' }]
    expect(mergeMessageById(msgs, { id: 'x', deleted: true })).toBe(msgs)
  })
})
