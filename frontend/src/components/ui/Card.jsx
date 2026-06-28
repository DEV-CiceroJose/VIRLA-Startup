/**
 * Cartão base do Design System Virla — superfície branca translúcida
 * com borda lilás e sombra suave. Usado em painéis, formulários e listas.
 */
export default function Card({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component
      className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-virla-roxomid/40 shadow-virla ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}
