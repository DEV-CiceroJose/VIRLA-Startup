/**
 * Operações puras sobre a lista de notificações da central (PROD-03).
 * Isoladas do provider para permitir teste sem socket/rede.
 */

/** Insere uma notificação recebida, colapsando MESSAGE não-lida por remetente. */
export function upsertNotification(list, incoming) {
  if (incoming.type === 'MESSAGE') {
    const idx = list.findIndex(
      (n) => n.type === 'MESSAGE' && n.senderId === incoming.senderId && !n.read,
    )
    if (idx !== -1) {
      const next = list.slice()
      next.splice(idx, 1)
      return [incoming, ...next]
    }
  }
  return [incoming, ...list]
}

/** Nº de notificações não-lidas. */
export function countUnread(list) {
  return list.filter((n) => !n.read).length
}

/** Marca a notificação de `id` como lida. */
export function markReadInList(list, id) {
  return list.map((n) => (n.id === id ? { ...n, read: true } : n))
}

/** Marca todas como lidas. */
export function markAllReadInList(list) {
  return list.map((n) => ({ ...n, read: true }))
}

/** Marca como lidas as MESSAGE de um remetente. */
export function markConversationReadInList(list, senderId) {
  return list.map((n) =>
    n.type === 'MESSAGE' && n.senderId === senderId ? { ...n, read: true } : n,
  )
}
