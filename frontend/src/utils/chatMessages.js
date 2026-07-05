export const DELETE_WINDOW_MS = 600_000 // 10 minutos

/** Pode o usuário apagar esta mensagem agora? (própria, não apagada, não otimista, dentro da janela) */
export function canDeleteMessage(message, meId, nowMs = Date.now()) {
  if (!message || message.senderId !== meId) return false
  if (message.deleted || message._optimistic) return false
  return nowMs - message.createdAt <= DELETE_WINDOW_MS
}

/** Substitui a mensagem de mesmo id por { ...antigo, ...changed }; lista inalterada se o id sumir. */
export function mergeMessageById(messages, changed) {
  const idx = messages.findIndex((m) => m.id === changed.id)
  if (idx === -1) return messages
  const next = [...messages]
  next[idx] = { ...next[idx], ...changed }
  return next
}
