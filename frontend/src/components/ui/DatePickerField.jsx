import { useEffect, useId, useMemo, useRef, useState } from 'react'
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dateFromISO(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

function dateToISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value) {
  const date = dateFromISO(value)
  return date ? new Intl.DateTimeFormat('pt-BR').format(date) : ''
}

function addDays(iso, days) {
  const date = dateFromISO(iso)
  if (!date) return ''
  date.setDate(date.getDate() + days)
  return dateToISO(date)
}

export default function DatePickerField({
  label,
  required,
  value = '',
  onChange,
  min,
  max,
  disabled,
  error,
  hint,
  id: providedId,
  name,
  placeholder = 'Escolha uma data',
}) {
  const autoId = useId()
  const id = providedId ?? autoId
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const initialDate = dateFromISO(value) || dateFromISO(min) || dateFromISO(max) || new Date()
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const rangeIsValid = !min || !max || min <= max

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open, value, min, max])

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      const iso = dateToISO(date)
      return {
        date,
        iso,
        outside: date.getMonth() !== visibleMonth.getMonth(),
        disabled: !rangeIsValid || Boolean((min && iso < min) || (max && iso > max)),
      }
    })
  }, [visibleMonth, min, max, rangeIsValid])

  const shortcuts = [
    { label: 'Hoje', value: todayISO() },
    { label: 'Amanhã', value: addDays(todayISO(), 1) },
    { label: 'Em 7 dias', value: addDays(todayISO(), 7) },
  ].filter((item) => (!min || item.value >= min) && (!max || item.value <= max))

  function apply() {
    if (!draft) return
    onChange?.({ target: { value: draft, name } })
    setOpen(false)
  }

  function togglePicker() {
    if (!open) {
      setDraft(value)
      const base = dateFromISO(value) || dateFromISO(min) || dateFromISO(max) || new Date()
      setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    }
    setOpen((current) => !current)
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
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        value={value}
        disabled={disabled || !rangeIsValid}
        onClick={togglePicker}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl border bg-white/90 px-4 py-3 text-left text-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-virla-texto/40 ${
          error ? 'border-red-300 focus:ring-red-300' : open ? 'border-virla-roxo ring-2 ring-virla-roxo/20 shadow-virla' : 'border-virla-roxomid/70 hover:border-virla-roxo/55 focus:ring-virla-roxo/30'
        }`}
      >
        <span className={value ? 'font-semibold text-virla-texto' : 'text-virla-texto/45'}>{formatDate(value) || placeholder}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-virla-roxo/7 text-virla-roxo"><CalendarMonth sx={{ fontSize: 19 }} /></span>
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      {open && (
        <div role="dialog" aria-label={`Calendário de ${label}`} className="absolute left-0 z-[150] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-virla-roxo/10 bg-white shadow-virla-lg animate-slide-down">
          {shortcuts.length > 0 && (
            <div className="flex gap-2 border-b border-virla-roxo/8 bg-virla-roxo/[0.025] p-3">
              {shortcuts.map((item) => (
                <button key={item.value} type="button" onClick={() => { setDraft(item.value); const date = dateFromISO(item.value); setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1)) }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${draft === item.value ? 'bg-virla-roxo text-white' : 'bg-white text-virla-roxo hover:bg-virla-roxo/8'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" aria-label="Mês anterior" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-virla-roxo hover:bg-virla-roxo/8"><ChevronLeft /></button>
              <strong className="text-sm capitalize text-virla-texto">{MONTHS[visibleMonth.getMonth()]} de {visibleMonth.getFullYear()}</strong>
              <button type="button" aria-label="Próximo mês" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-virla-roxo hover:bg-virla-roxo/8"><ChevronRight /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="pb-1 text-[11px] font-bold text-virla-muted">{day}</span>)}
              {days.map((day) => {
                const selected = day.iso === draft
                const isToday = day.iso === todayISO()
                return (
                  <button
                    key={day.iso}
                    type="button"
                    disabled={day.disabled}
                    aria-label={new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(day.date)}
                    aria-pressed={selected}
                    onClick={() => setDraft(day.iso)}
                    className={`aspect-square rounded-xl text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-25 ${
                      selected ? 'bg-virla-roxo text-white shadow-sm scale-105' : day.outside ? 'text-virla-muted/35 hover:bg-virla-roxo/5' : isToday ? 'border border-virla-roxo/30 text-virla-roxo hover:bg-virla-roxo/8' : 'text-virla-texto hover:bg-virla-roxo/8'
                    }`}
                  >
                    {day.date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-virla-roxo/8 bg-virla-roxo/[0.025] p-3">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-virla-muted hover:bg-virla-roxo/7">Cancelar</button>
            <button type="button" disabled={!draft} onClick={apply} className="rounded-xl bg-virla-roxo px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-virla-roxohighlight disabled:opacity-40">Aplicar data</button>
          </div>
        </div>
      )}

      {hint && !error && <p id={hintId} className="text-xs text-virla-muted">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  )
}
