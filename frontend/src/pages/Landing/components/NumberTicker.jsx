import { useEffect, useRef, useState } from 'react'

/**
 * NumberTicker — adaptado do "Number Ticker" (Magic UI) do 21st.dev.
 * Conta de 0 até o valor quando entra na tela, uma vez só. Sem animação
 * para quem prefere menos movimento (e nos testes, sem IntersectionObserver).
 */
function canAnimate() {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export default function NumberTicker({ value, decimals = 0, prefix = '', suffix = '', duration = 1400 }) {
  const ref = useRef(null)
  const [animate] = useState(canAnimate)
  const [shown, setShown] = useState(() => (animate ? 0 : value))

  useEffect(() => {
    const el = ref.current
    if (!el || !animate) return undefined

    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - (1 - t) ** 3
        setShown(value * eased)
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [value, duration, animate])

  const text = shown.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const final = value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  return (
    <span ref={ref} className="nt" aria-label={`${prefix}${final}${suffix}`}>
      <span aria-hidden="true">{prefix}{text}{suffix}</span>
    </span>
  )
}
