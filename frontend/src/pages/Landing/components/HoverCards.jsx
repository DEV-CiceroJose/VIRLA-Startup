import { useState } from 'react'

/**
 * HoverCards — adaptado do "Card Hover Effect" (Aceternity) do 21st.dev.
 * Um único destaque desliza para o cartão sob o mouse, em vez de cada
 * cartão acender sozinho. Os cartões são só informativos (sem foco).
 */
export default function HoverCards({ items }) {
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [visible, setVisible] = useState(false)

  const moveTo = (event) => {
    const el = event.currentTarget
    // O destaque abraça o cartão (que tem 10px de margem), como no original.
    const m = 10
    setBox({ x: el.offsetLeft - m, y: el.offsetTop - m, w: el.offsetWidth + m * 2, h: el.offsetHeight + m * 2 })
    setVisible(true)
  }

  return (
    <div className="hc-grid" onMouseLeave={() => setVisible(false)}>
      <span
        className={`hc-highlight${visible ? ' is-visible' : ''}`}
        style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
        aria-hidden="true"
      />
      {items.map(({ Icon, title, text, tone }) => (
        <article key={title} className={`hc-card tone-${tone}`} onMouseEnter={moveTo}>
          <span className="hc-icon"><Icon /></span>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  )
}
