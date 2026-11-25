import { useEffect, useRef, useState } from 'react'
import './fan-deck-card.css'

/**
 * FanDeckCard — adaptado do "Fan Deck" do 21st.dev.
 *
 * Em repouso é uma pilha arrumada com a carta do topo à mostra. Ao passar o
 * mouse (ou focar com o teclado), as cartas abrem em leque; a que está sob o
 * cursor se levanta. Clicar numa carta a traz para o topo. Setas do teclado,
 * os botões ← → e o gesto de arrastar no celular passam de uma em uma.
 *
 * Diferenças do original:
 * - JSX + CSS puro (o projeto não usa TypeScript nem shadcn).
 * - A pilha é sempre uma "rotação" da lista na ordem original, então avançar
 *   e voltar percorrem todas as cartas (no original, avançar alternava só
 *   entre as duas primeiras) e o leque fica em ordem cronológica.
 * - `onChange(index)` avisa a carta do topo, para mostrar detalhes ao lado;
 *   com `index` o componente fica controlado (ex.: índice clicável fora dele).
 *
 * Cada carta: { id, title, meta, blurb, art, tint }.
 */
export default function FanDeckCard({
  cards,
  label = 'Cartas',
  index,
  initialIndex = 0,
  motion = 'full',
  className = '',
  onChange,
}) {
  const n = cards.length
  const [inner, setInner] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(n - 1, 0)))
  const current = index ?? inner
  const setCurrent = (value) => {
    if (index === undefined) setInner(value)
    onChange?.(value)
  }
  const [open, setOpen] = useState(false)
  const [over, setOver] = useState(null)
  const [lifting, setLifting] = useState(null)
  const swipe = useRef(null)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const reduced = () =>
    motion === 'reduced' || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  /** Traz a carta `index` para o topo: ela sai do leque e depois se encaixa. */
  const toTop = (index) => {
    if (n < 2 || index === current || lifting !== null) return
    if (reduced()) {
      setCurrent(index)
      return
    }
    setLifting(index)
    timers.current.push(window.setTimeout(() => setCurrent(index), 230))
    timers.current.push(window.setTimeout(() => setLifting(null), 560))
  }
  const deal = (dir) => toTop((current + dir + n) % n)

  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); deal(1) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); deal(-1) }
  }

  return (
    <section
      className={`fd ${className}`}
      style={{ '--n': n }}
      data-motion={motion}
      data-open={open || undefined}
      aria-label={label}
      aria-roledescription="baralho"
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') setOpen(true) }}
      onPointerLeave={() => { setOpen(false); setOver(null) }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}
      onKeyDown={onKey}
    >
      <div
        className="fd__hand"
        onPointerDown={(e) => { swipe.current = { x: e.clientX, t: e.timeStamp } }}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s) return
          const dx = e.clientX - s.x
          if (Math.abs(dx) > 40 && e.timeStamp - s.t < 600) deal(dx < 0 ? 1 : -1)
        }}
      >
        {cards.map((c, j) => {
          // i = posição na pilha (0 = topo). Topo à direita; as próximas abrem para a esquerda.
          const i = (j - current + n) % n
          const f = n > 1 ? 0.5 - i / (n - 1) : 0
          const lift = lifting === j
          const top = i === 0
          return (
            <button
              key={c.id}
              type="button"
              className="fd__card"
              data-top={top || undefined}
              data-over={over === j || undefined}
              data-lift={lift || undefined}
              style={{
                '--i': i,
                '--f': f,
                '--r': `${(i % 2 ? -1 : 1) * Math.min(i, 4) * 1.5}deg`,
                '--tint': c.tint,
                zIndex: lift ? 100 : n - i,
              }}
              onPointerEnter={() => setOver(j)}
              onPointerLeave={() => setOver((o) => (o === j ? null : o))}
              onClick={() => toTop(j)}
              aria-current={top || undefined}
              aria-label={top ? `${c.title}, ${c.meta}. No topo.` : `Trazer ${c.title} para o topo`}
              tabIndex={top ? 0 : -1}
            >
              <div className="fd__art" aria-hidden="true">{c.art}</div>
              <div className="fd__body">
                <span className="fd__meta">{c.meta}</span>
                <span className="fd__title">{c.title}</span>
                <span className="fd__blurb">{c.blurb}</span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="fd__ctl">
        <button type="button" onClick={() => deal(-1)} aria-label="Carta anterior">←</button>
        <span aria-live="polite">
          {cards[current]?.title} · {current + 1} de {n}
        </span>
        <button type="button" onClick={() => deal(1)} aria-label="Próxima carta">→</button>
      </div>
    </section>
  )
}
