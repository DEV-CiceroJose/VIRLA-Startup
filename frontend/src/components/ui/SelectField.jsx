import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import Check from '@mui/icons-material/Check'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'

const CONTROL_CLASS =
  'w-full min-h-12 rounded-xl border bg-white/90 text-sm text-left transition-all duration-200 ' +
  'focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-virla-texto/40 disabled:cursor-not-allowed'

function optionList(children) {
  return Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === 'option')
    .map((child) => ({
      value: String(child.props.value ?? ''),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    }))
}

export default function SelectField({
  label,
  icon: Icon,
  error,
  hint,
  className = '',
  id: providedId,
  required,
  children,
  value = '',
  onChange,
  name,
  disabled,
  placeholder = 'Selecione uma opção',
}) {
  const autoId = useId()
  const id = providedId ?? autoId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const listboxId = `${id}-options`
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const options = useMemo(() => optionList(children), [children])
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === String(value ?? '')))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selected = options.find((option) => option.value === String(value ?? ''))

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  function choose(option) {
    if (option.disabled) return
    onChange?.({ target: { value: option.value, name } })
    setOpen(false)
  }

  function handleKeyDown(event) {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const direction = event.key === 'ArrowDown' ? 1 : -1
      let next = activeIndex
      do next = (next + direction + options.length) % options.length
      while (options[next]?.disabled && next !== activeIndex)
      setActiveIndex(next)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open && options[activeIndex]) choose(options[activeIndex])
      else setOpen(true)
    }
  }

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  const ring = error
    ? 'border-red-300 focus:ring-red-300 focus:border-red-400'
    : open
      ? 'border-virla-roxo ring-2 ring-virla-roxo/20 shadow-virla'
      : 'border-virla-roxomid/70 hover:border-virla-roxo/55 focus:ring-virla-roxo/30 focus:border-virla-roxo'

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      {label && (
        <label id={`${id}-label`} htmlFor={id} className="block text-xs font-semibold text-virla-muted uppercase tracking-wide">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
        </label>
      )}

      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        value={value}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(selectedIndex)
          setOpen((current) => !current)
        }}
        onKeyDown={handleKeyDown}
        className={`${CONTROL_CLASS} ${ring} ${Icon ? 'pl-10' : 'pl-4'} pr-11 py-3 ${className}`}
      >
        {Icon && <Icon sx={{ fontSize: 18 }} className="pointer-events-none absolute left-3 top-[2.5rem] -translate-y-1/2 text-virla-roxo/50" aria-hidden />}
        <span className={`block truncate font-medium ${selected?.value ? 'text-virla-texto' : 'text-virla-texto/45'}`}>
          {selected?.label ?? placeholder}
        </span>
        <span className={`absolute right-3 top-[2.5rem] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-virla-roxo/7 text-virla-roxo transition-transform ${open ? 'rotate-180' : ''}`}>
          <KeyboardArrowDown sx={{ fontSize: 21 }} aria-hidden />
        </span>
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute z-[140] mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-virla-roxo/10 bg-white p-2 shadow-virla-lg virla-scroll animate-slide-down"
        >
          {options.map((option, index) => {
            const isSelected = option.value === String(value ?? '')
            const isActive = index === activeIndex
            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
                  isSelected
                    ? 'bg-virla-roxo text-white shadow-sm'
                    : isActive
                      ? 'bg-virla-roxo/8 text-virla-roxo'
                      : 'text-virla-texto hover:bg-virla-roxo/5'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                {isSelected && <Check sx={{ fontSize: 18 }} aria-hidden />}
              </button>
            )
          })}
        </div>
      )}

      {hint && !error && <p id={hintId} className="text-xs text-virla-muted">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  )
}
