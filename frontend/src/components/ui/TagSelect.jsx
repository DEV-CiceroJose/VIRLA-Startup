/**
 * Multi-select de chips a partir de uma lista fixa de opções.
 * Clique alterna seleção; ao atingir `max`, as opções não selecionadas
 * ficam desabilitadas.
 */
export default function TagSelect({ options, value = [], onChange, max, label }) {
  function toggle(optValue) {
    const selected = value.includes(optValue)
    if (selected) {
      onChange(value.filter((v) => v !== optValue))
      return
    }
    if (max != null && value.length >= max) return
    onChange([...value, optValue])
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <span className="block text-xs font-semibold text-virla-muted uppercase tracking-wide">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((opt) => {
          const selected = value.includes(opt.value)
          const disabled = !selected && max != null && value.length >= max
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selected
                  ? 'bg-virla-roxo text-white border-virla-roxo'
                  : 'bg-white text-virla-texto/70 border-virla-roxo/25 hover:bg-virla-roxo/5'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
