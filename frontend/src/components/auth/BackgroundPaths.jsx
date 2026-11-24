/**
 * BackgroundPaths — adaptado do "Background Paths" (Kokonut UI, 21st.dev).
 * Dois feixes de curvas finas atravessam a tela; trechos de cada linha
 * correm devagar (stroke-dashoffset em CSS, sem framer-motion). Com
 * movimento reduzido as linhas ficam paradas.
 */
function Paths({ position }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    opacity: 0.05 + i * 0.012,
    duration: 22 + (i % 9) * 2.5,
    delay: -((i * 1.7) % 20),
  }))

  return (
    <svg className="va-paths" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice">
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          pathLength="1"
          strokeWidth={path.width}
          strokeOpacity={path.opacity}
          style={{ animationDuration: `${path.duration}s`, animationDelay: `${path.delay}s` }}
        />
      ))}
    </svg>
  )
}

export default function BackgroundPaths() {
  return (
    <div className="va-bg" aria-hidden="true">
      <Paths position={1} />
      <Paths position={-1} />
    </div>
  )
}
