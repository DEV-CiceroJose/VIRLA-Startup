import { useState } from 'react'
import FanDeckCard from '../../../components/ui/FanDeckCard'

/**
 * Trajetória em baralho (FanDeckCard, 21st.dev): à esquerda as cartas em
 * leque, à direita o marco do topo com o texto completo e um índice de todos
 * os marcos para pular direto a qualquer um.
 */
const TINTS = ['#810c89', '#d946b4', '#5b2a86', '#c2408f', '#9b2a9b']

function Art({ item }) {
  if (item.img) {
    return (
      <img
        src={item.img}
        alt=""
        loading="lazy"
        style={{
          objectPosition: item.position,
          objectFit: item.contain ? 'contain' : undefined,
          background: item.contain ? '#fff' : undefined,
        }}
      />
    )
  }
  return (
    <div className={`jd-art${item.next ? ' is-next' : ''}`}>
      <span>{item.step}</span>
    </div>
  )
}

const metaOf = (item) => (item.current ? `${item.step} · Agora` : item.next ? `${item.step} · Em breve` : `Marco ${item.step}`)

export default function JourneyDeck({ items }) {
  const [index, setIndex] = useState(0)
  const item = items[index]
  const cards = items.map((it, i) => ({
    id: it.step,
    title: it.title,
    meta: metaOf(it),
    blurb: it.text,
    tint: TINTS[i % TINTS.length],
    art: <Art item={it} />,
  }))

  return (
    <div className="jd">
      <FanDeckCard cards={cards} index={index} onChange={setIndex} label="Marcos da trajetória da VIRLA" />

      <div className="jd-detail">
        <div className="jd-detail-card" aria-live="polite">
          <span className="jd-step">{item.step}<small>/{String(items.length).padStart(2, '0')}</small></span>
          {item.current && <span className="tl-now">Agora</span>}
          {item.next && <span className="tl-now is-next">Em breve</span>}
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </div>

        <nav className="jd-index" aria-label="Todos os marcos">
          <ol>
            {items.map((it, i) => (
              <li key={it.step}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? 'step' : undefined}
                  className={`${it.current ? 'is-current' : ''}${it.next ? ' is-next' : ''}`}
                >
                  <span>{it.step}</span> {it.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <p className="jd-hint">Passe o mouse para abrir o leque · use ← → ou arraste para navegar.</p>
      </div>
    </div>
  )
}
