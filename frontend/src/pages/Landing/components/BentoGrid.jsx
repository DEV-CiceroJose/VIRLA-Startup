/**
 * BentoGrid — adaptado do "Bento Grid" (Magic UI) do 21st.dev.
 * Células de tamanhos diferentes; `span` controla quantas colunas/linhas
 * cada uma ocupa no desktop (no celular todas viram uma coluna).
 */
export function BentoGrid({ children }) {
  return <div className="bento">{children}</div>
}

export function BentoCell({ Icon, title, children, span = '', featured = false, tone = 'purple' }) {
  return (
    <article className={`bento-cell ${span} tone-${tone}${featured ? ' is-featured' : ''}`}>
      <span className="bento-glow" aria-hidden="true" />
      <span className="bento-icon"><Icon /></span>
      <h3>{title}</h3>
      <div className="bento-body">{children}</div>
    </article>
  )
}
