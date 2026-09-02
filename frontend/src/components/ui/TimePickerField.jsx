import { useEffect, useId, useRef, useState } from 'react'
import AccessTime from '@mui/icons-material/AccessTime'

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))

export default function TimePickerField({ label, required, value = '', onChange, disabled, error, hint, id: providedId, name }) {
  const autoId = useId()
  const id = providedId ?? autoId
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState('08')
  const [minute, setMinute] = useState('00')

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    requestAnimationFrame(() => {
      rootRef.current?.querySelectorAll('[data-time-selected="true"]').forEach((node) => node.scrollIntoView?.({ block: 'center' }))
    })
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open, value])

  function apply() {
    onChange?.({ target: { value: `${hour}:${minute}`, name } })
    setOpen(false)
  }

  function togglePicker() {
    if (!open) {
      const [nextHour = '08', rawMinute = '00'] = value.split(':')
      const roundedMinute = String(Math.round(Number(rawMinute) / 5) * 5 % 60).padStart(2, '0')
      setHour(HOURS.includes(nextHour) ? nextHour : '08')
      setMinute(MINUTES.includes(roundedMinute) ? roundedMinute : '00')
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
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        value={value}
        disabled={disabled}
        onClick={togglePicker}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl border bg-white/90 px-4 py-3 text-left text-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 ${
          error ? 'border-red-300 focus:ring-red-300' : open ? 'border-virla-roxo ring-2 ring-virla-roxo/20 shadow-virla' : 'border-virla-roxomid/70 hover:border-virla-roxo/55 focus:ring-virla-roxo/30'
        }`}
      >
        <span className="font-semibold tabular-nums text-virla-texto">{value || '--:--'}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-virla-roxo/7 text-virla-roxo"><AccessTime sx={{ fontSize: 19 }} /></span>
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      {open && (
        <div role="dialog" aria-label={`Escolher ${label.toLowerCase()}`} className="absolute right-0 z-[150] mt-2 w-64 overflow-hidden rounded-2xl border border-virla-roxo/10 bg-white shadow-virla-lg animate-slide-down">
          <div className="border-b border-virla-roxo/8 bg-gradient-to-r from-virla-roxo/8 to-violet-50 px-4 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-virla-muted">Escolha o horário</p>
            <strong className="mt-1 block text-2xl tabular-nums text-virla-roxo">{hour}:{minute}</strong>
          </div>
          <div className="relative grid grid-cols-2 gap-2 p-3">
            <div className="pointer-events-none absolute inset-x-3 top-1/2 z-10 h-10 -translate-y-1/2 rounded-xl border border-virla-roxo/15 bg-virla-roxo/6" />
            <div className="relative z-20">
              <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-virla-muted">Hora</p>
              <div className="h-40 snap-y snap-mandatory overflow-y-auto py-[3.75rem] virla-scroll">
                {HOURS.map((item) => (
                  <button key={item} type="button" data-time-selected={item === hour} aria-label={`Hora ${item}`} aria-pressed={item === hour} onClick={() => setHour(item)} className={`block h-10 w-full snap-center rounded-lg text-center text-sm tabular-nums transition-all ${item === hour ? 'font-black text-virla-roxo scale-110' : 'text-virla-muted/55 hover:text-virla-roxo'}`}>{item}</button>
                ))}
              </div>
            </div>
            <div className="relative z-20">
              <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-virla-muted">Minuto</p>
              <div className="h-40 snap-y snap-mandatory overflow-y-auto py-[3.75rem] virla-scroll">
                {MINUTES.map((item) => (
                  <button key={item} type="button" data-time-selected={item === minute} aria-label={`Minuto ${item}`} aria-pressed={item === minute} onClick={() => setMinute(item)} className={`block h-10 w-full snap-center rounded-lg text-center text-sm tabular-nums transition-all ${item === minute ? 'font-black text-virla-roxo scale-110' : 'text-virla-muted/55 hover:text-virla-roxo'}`}>{item}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 border-t border-virla-roxo/8 bg-virla-roxo/[0.025] p-3">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-virla-muted hover:bg-virla-roxo/7">Cancelar</button>
            <button type="button" onClick={apply} className="flex-1 rounded-xl bg-virla-roxo px-3 py-2 text-xs font-bold text-white hover:bg-virla-roxohighlight">Aplicar</button>
          </div>
        </div>
      )}

      {hint && !error && <p id={hintId} className="text-xs text-virla-muted">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  )
}
