import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import GlassCalendar from './GlassCalendar'
import { addDays, formatDate, todayISO } from './dateUtils'

/**
 * Campo de data do Design System Virla: o gatilho mostra dd/mm/aaaa e abre
 * o GlassCalendar (visão mensal).
 *
 * - Controlado: `value` + `onChange({ target: { value, name } })`.
 * - Não controlado: `ref` (lê `ref.current.value`, como um <input>) e
 *   `defaultValue`, para os formulários com useRef já existentes.
 * - `shortcuts={false}` esconde Hoje/Amanhã/Em 7 dias (ex.: nascimento).
 */
export default function DatePickerField({
  label,
  required,
  value,
  defaultValue = '',
  onChange,
  min,
  max,
  disabled,
  error,
  hint,
  id: providedId,
  name,
  placeholder = 'Escolha uma data',
  shortcuts = true,
  ref,
}) {
  const autoId = useId()
  const id = providedId ?? autoId
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [inner, setInner] = useState(defaultValue)
  const controlled = value !== undefined
  const current = (controlled ? value : inner) || ''
  const iso = current.split('T')[0]
  const rangeIsValid = !min || !max || min <= max

  useImperativeHandle(ref, () => ({
    get value() { return iso },
    name,
    focus: () => buttonRef.current?.focus(),
  }), [iso, name])

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const quick = shortcuts
    ? [
        { label: 'Hoje', value: todayISO() },
        { label: 'Amanhã', value: addDays(todayISO(), 1) },
        { label: 'Em 7 dias', value: addDays(todayISO(), 7) },
      ].filter((item) => (!min || item.value >= min) && (!max || item.value <= max))
    : []

  function apply(next) {
    if (!controlled) setInner(next)
    onChange?.({ target: { value: next, name } })
    setOpen(false)
    buttonRef.current?.focus()
  }

  function cancel() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-virla-muted">
        {label}{required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        value={iso}
        disabled={disabled || !rangeIsValid}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl border bg-white/90 px-4 py-3 text-left text-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-virla-texto/40 ${
          error ? 'border-red-300 focus:ring-red-300' : open ? 'border-virla-roxo ring-2 ring-virla-roxo/20 shadow-virla' : 'border-virla-roxomid/70 hover:border-virla-roxo/55 focus:ring-virla-roxo/30'
        }`}
      >
        <span className={iso ? 'font-semibold tabular-nums text-virla-texto' : 'text-virla-texto/45'}>{formatDate(iso) || placeholder}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-virla-roxo/7 text-virla-roxo"><CalendarMonth sx={{ fontSize: 19 }} /></span>
      </button>
      {name && <input type="hidden" name={name} value={iso} />}

      {open && (
        <GlassCalendar
          label={label}
          initialValue={iso}
          min={min}
          max={max}
          shortcuts={quick}
          onCancel={cancel}
          onApply={apply}
        />
      )}

      {hint && !error && <p id={hintId} className="text-xs text-virla-muted">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  )
}
