/**
 * Marquee — adaptado do componente "Marquee" (Magic UI) do 21st.dev.
 * Faixa que rola sozinha, pausa ao passar o mouse e fica parada para quem
 * prefere menos movimento. O conteúdo é duplicado só para o loop; a cópia
 * fica escondida de leitores de tela.
 */
export default function Marquee({ items, label, duration = 40 }) {
  return (
    <div className="mq" role="region" aria-label={label} style={{ '--mq-duration': `${duration}s` }}>
      <div className="mq-track">
        <ul className="mq-group">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <ul className="mq-group" aria-hidden="true">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  )
}
