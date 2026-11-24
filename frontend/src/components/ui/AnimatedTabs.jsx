import { useLayoutEffect, useRef, useState } from 'react'

/**
 * AnimatedTabs — adaptado do "Animated Tabs" (21st.dev): uma pílula desliza
 * até a aba ativa. Setas do teclado trocam de aba (padrão WAI-ARIA tablist).
 * `tabs` = [{ value, label, count? }].
 */
export default function AnimatedTabs({ tabs, value, onChange, label }) {
  const listRef = useRef(null)
  const [pill, setPill] = useState(null)

  useLayoutEffect(() => {
    const list = listRef.current
    const active = list?.querySelector('[aria-selected="true"]')
    if (!active) return undefined
    const update = () => setPill({ left: active.offsetLeft, width: active.offsetWidth })
    update()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    observer?.observe(list)
    return () => observer?.disconnect()
  }, [value, tabs])

  function onKeyDown(event) {
    const index = tabs.findIndex((t) => t.value === value)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = tabs[(index + step + tabs.length) % tabs.length]
    onChange(next.value)
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-value="${next.value}"]`)?.focus())
  }

  return (
    <div ref={listRef} className="vx-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {pill && <span className="vx-tabs-pill" aria-hidden="true" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />}
      {tabs.map((tab) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            data-value={tab.value}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="vx-tab"
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count > 0 && <span className="vx-tab-count">{tab.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
