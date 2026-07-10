import { useState, useRef, useEffect } from 'react'
import EmojiEmotions from '@mui/icons-material/EmojiEmotions'

// ~48 emojis comuns de conversa (inclui alguns do contexto de cuidado).
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂',
  '🙃', '😉', '😊', '😍', '😘', '🤗', '🤔', '😐',
  '😴', '😷', '🤒', '👍', '👎', '👏', '🙏', '💪',
  '👋', '🎉', '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🔥', '✨', '⭐', '✅', '❌', '⏰', '📌', '📎',
  '🩺', '💊', '🏥', '🚑', '👨‍⚕️', '👩‍⚕️', '😢', '🙌',
]

/** Seletor de emoji próprio (sem dependência). onSelect(emoji) recebe o escolhido. */
export default function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gray-100 text-virla-roxo flex items-center justify-center hover:bg-gray-200 transition-all"
        aria-label="Emojis"
      >
        <EmojiEmotions sx={{ fontSize: 24 }} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-14 left-0 z-50 w-64 max-h-48 overflow-y-auto grid grid-cols-8 gap-1 p-2 bg-white rounded-xl border border-virla-roxo/15 shadow-lg"
        >
          {EMOJIS.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => { onSelect(emoji); setOpen(false) }}
              className="text-xl leading-none p-1 rounded hover:bg-virla-roxo/10"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
