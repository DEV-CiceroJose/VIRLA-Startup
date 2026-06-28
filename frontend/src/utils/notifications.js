// Lazy-create an AudioContext only when first needed (browser requires a user gesture first)
let audioCtx = null

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

/**
 * Plays a short, soft two-tone chime using the Web Audio API.
 * No external audio file required.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    gain.connect(ctx.destination)

    ;[523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.4)
    })
  } catch {
    // Silently skip if audio isn't available (e.g. blocked by browser policy)
  }
}

/**
 * Shows a browser Notification if permission is granted.
 * Silently skips if the user hasn't granted permission.
 *
 * Aceita dois formatos de payload:
 *   - Legado:  { sender: { name }, content, senderId }
 *   - Novo:    { senderId, preview }   ← formato enviado pelo SocketContext
 */
export function showBrowserNotification(message) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') {
    // Request permission once — subsequent calls are instant
    Notification.requestPermission()
    return
  }

  // Suporta tanto { sender.name } (legado) quanto { preview } (formato atual do SocketContext)
  const senderName = message?.sender?.name ?? 'Nova mensagem'
  const body = (message?.preview ?? message?.content ?? '').slice(0, 60)

  new Notification(senderName, {
    body,
    icon: '/favicon.ico',
    tag: `chat-${message?.senderId}`, // Replaces previous notification from same sender
    renotify: true,
  })
}
