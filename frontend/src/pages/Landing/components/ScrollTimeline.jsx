import { useEffect, useRef } from 'react'

/**
 * ScrollTimeline — adaptado do "Timeline" (Aceternity) do 21st.dev.
 * Título de cada marco fica fixo à esquerda enquanto o conteúdo passa, e um
 * feixe roxo→rosa preenche a linha conforme a rolagem. Sem feixe animado
 * para quem prefere menos movimento (a linha aparece cheia).
 */
export default function ScrollTimeline({ items }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      el.style.setProperty('--beam', '1')
      return undefined
    }
    let frame = 0
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const progress = (window.innerHeight * 0.6 - rect.top) / rect.height
      el.style.setProperty('--beam', String(Math.min(1, Math.max(0, progress))))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <ol className="tl" ref={ref}>
      <span className="tl-line" aria-hidden="true"><span className="tl-beam" /></span>
      {items.map((item) => (
        <li key={item.title} className={`tl-item${item.current ? ' is-current' : ''}`}>
          <div className="tl-head">
            <span className="tl-dot" aria-hidden="true"><span /></span>
            <span className="tl-step">{item.step}</span>
            <h3>{item.title}</h3>
          </div>
          <div className="tl-content">
            <h3 className="tl-mobile-title">{item.title}</h3>
            {item.current && <span className="tl-now">Agora</span>}
            <p>{item.text}</p>
            {item.img && (
              <img
                src={item.img}
                alt={item.alt ?? ''}
                loading="lazy"
                className={item.contain ? 'is-contain' : undefined}
                style={item.position ? { objectPosition: item.position } : undefined}
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
