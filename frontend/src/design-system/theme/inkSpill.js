import { flushSync } from 'react-dom'
import { coverRadius, inkPath, makeInk } from './ink'
import './ink-spill.css'

/**
 * Troca de tema com tinta (adaptado do "Ink Spill Theme Switch", 21st.dev).
 *
 * O original renderiza a página duas vezes dentro de um palco com rolagem
 * própria. Aqui o efeito usa a View Transitions API: o navegador tira uma foto
 * da tela no tema atual e o tema novo "escorre" por cima, recortado por uma
 * mancha de tinta que nasce no botão clicado. A rolagem e o ThemeProvider
 * continuam iguais. Sem suporte à API ou com movimento reduzido, o tema troca
 * na hora.
 */

const DURATION = 1200
let busy = false

export function spillTheme({ from, next, setTheme }) {
  if (busy) return
  const root = document.documentElement
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (still || !from || typeof document.startViewTransition !== 'function') {
    setTheme(next)
    return
  }

  const box = from.getBoundingClientRect()
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  const ink = makeInk((Math.random() * 2 ** 31) | 0)
  const Rend = coverRadius(ink, x, y, window.innerWidth, window.innerHeight)
  const empty = `circle(0px at ${x}px ${y}px)`

  busy = true
  root.style.setProperty('--ink-clip', empty)
  root.style.setProperty('--ink-duration', `${DURATION}ms`)
  root.classList.add('ink-spilling')

  const transition = document.startViewTransition(() => {
    root.dataset.theme = next
    root.style.colorScheme = next
    flushSync(() => setTheme(next))
  })

  let raf = 0
  transition.ready.then(() => {
    const start = performance.now()
    const frame = (now) => {
      const p = Math.min(1, (now - start) / DURATION)
      const d = inkPath(ink, x, y, Rend, p)
      root.style.setProperty('--ink-clip', d ? `path("${d}")` : empty)
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
  }).catch(() => {})

  transition.finished.finally(() => {
    cancelAnimationFrame(raf)
    root.classList.remove('ink-spilling')
    root.style.removeProperty('--ink-clip')
    root.style.removeProperty('--ink-duration')
    busy = false
  })
}
