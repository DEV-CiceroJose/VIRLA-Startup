import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { useTheme } from '../../../design-system/theme/ThemeProvider'
import { coverRadius, inkPath, makeInk } from './ink'

const DURATION = 1200

/**
 * InkThemeToggle — adaptado do "Ink Spill Theme Switch" (21st.dev), só na landing.
 *
 * O original renderiza a página duas vezes dentro de um palco com rolagem
 * própria. Aqui o mesmo efeito usa a View Transitions API: o navegador tira
 * uma foto da página no tema atual e o tema novo "escorre" por cima, recortado
 * pela mancha de tinta que nasce no botão. A página continua com a rolagem
 * normal e o tema segue o ThemeProvider (salvo em localStorage).
 * Sem suporte à API ou com movimento reduzido, o tema troca na hora.
 */
export default function InkThemeToggle({ className = '' }) {
  const { isDark, setTheme } = useTheme()
  const busy = useRef(false)
  const label = `Ativar tema ${isDark ? 'claro' : 'escuro'}`

  function toggle(event) {
    if (busy.current) return
    const next = isDark ? 'light' : 'dark'
    const root = document.documentElement
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (still || typeof document.startViewTransition !== 'function') {
      setTheme(next)
      return
    }

    const box = event.currentTarget.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const ink = makeInk((Math.random() * 2 ** 31) | 0)
    const Rend = coverRadius(ink, x, y, window.innerWidth, window.innerHeight)
    const empty = `circle(0px at ${x}px ${y}px)`

    busy.current = true
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
      busy.current = false
    })
  }

  return (
    <button type="button" className={`landing-ink-toggle ${className}`.trim()} onClick={toggle} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </>
        ) : (
          <path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.4 8.4 0 1 0 10.6 10.6Z" />
        )}
      </svg>
    </button>
  )
}
