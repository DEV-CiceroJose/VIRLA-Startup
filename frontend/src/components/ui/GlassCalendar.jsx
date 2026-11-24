import { useEffect, useMemo, useRef, useState } from 'react'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { dateFromISO, dateToISO, todayISO } from './dateUtils'
import './glass-calendar.css'

/**
 * GlassCalendar — adaptado do "Glass Calendar" do 21st.dev.
 *
 * Fica só a visão mensal (a faixa semanal saiu): grade do mês inteiro,
 * leitura da data escolhida em dd/mm/aaaa e atalhos para trocar mês e ano
 * sem precisar passar mês a mês (útil para data de nascimento).
 * Sem dependências novas: datas com Date/Intl, animação em CSS.
 */

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const LONG_DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

const pad = (n) => String(n).padStart(2, '0')
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const monthKey = (date) => date.getFullYear() * 12 + date.getMonth()

export default function GlassCalendar({ label, initialValue = '', min, max, shortcuts = [], onCancel, onApply }) {
  const [draft, setDraft] = useState(initialValue)
  const [view, setView] = useState('days')
  const [visible, setVisible] = useState(() => {
    const today = todayISO()
    const fallback = (max && today > max) ? max : (min && today < min) ? min : today
    return monthStart(dateFromISO(initialValue) || dateFromISO(fallback))
  })
  const bodyRef = useRef(null)

  const minDate = dateFromISO(min)
  const maxDate = dateFromISO(max)
  const thisYear = new Date().getFullYear()
  const firstYear = minDate ? minDate.getFullYear() : thisYear - 110
  const lastYear = maxDate ? maxDate.getFullYear() : thisYear + 10

  const outOfRange = (iso) => Boolean((min && iso < min) || (max && iso > max))
  const canPrev = !minDate || monthKey(visible) > monthKey(minDate)
  const canNext = !maxDate || monthKey(visible) < monthKey(maxDate)

  const days = useMemo(() => {
    const total = new Date(visible.getFullYear(), visible.getMonth() + 1, 0).getDate()
    const lead = visible.getDay()
    const cells = Array.from({ length: lead }, (_, i) => ({ blank: true, key: `b${i}` }))
    for (let d = 1; d <= total; d++) {
      const date = new Date(visible.getFullYear(), visible.getMonth(), d)
      const iso = dateToISO(date)
      cells.push({ key: iso, iso, date, day: d })
    }
    return cells
  }, [visible])

  const years = Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, i) => firstYear + i)

  // Ao abrir e a cada troca de visão, o foco vai para o item escolhido
  // (ou hoje, ou o primeiro disponível) e a lista de anos rola até ele.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const target = body.querySelector('[data-current="true"]:not(:disabled)') || body.querySelector('button:not(:disabled)')
    target?.focus({ preventScroll: true })
    // Rola só a lista de anos (scrollIntoView rolaria a página inteira).
    const list = body.querySelector('.gc-years')
    if (list && target) list.scrollTop = target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2
  }, [view])

  const shift = (months) => setVisible((current) => new Date(current.getFullYear(), current.getMonth() + months, 1))

  function pickShortcut(iso) {
    setDraft(iso)
    setVisible(monthStart(dateFromISO(iso)))
    setView('days')
  }

  function onGridKey(event) {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (!(event.key in steps)) return
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(document.activeElement)
    if (index < 0) return
    event.preventDefault()
    let next = index + steps[event.key]
    while (buttons[next]?.disabled) next += Math.sign(steps[event.key])
    buttons[next]?.focus()
  }

  const draftDate = dateFromISO(draft)
  const today = todayISO()

  return (
    <div role="dialog" aria-label={`Calendário de ${label}`} className="gc-panel">
      <div className="gc-top">
        <span className="gc-top-label">Data escolhida</span>
        <output className={draftDate ? 'gc-readout' : 'gc-readout is-empty'} aria-live="polite">
          {draftDate ? (
            <><span>{pad(draftDate.getDate())}</span>/<span>{pad(draftDate.getMonth() + 1)}</span>/<span>{draftDate.getFullYear()}</span></>
          ) : 'dd/mm/aaaa'}
        </output>
      </div>

      <div className="gc-head">
        <div className="gc-title" key={`${view}-${monthKey(visible)}`}>
          {view === 'days' && (
            <>
              <button type="button" className="gc-title-month" aria-label={`${MONTHS[visible.getMonth()]}, escolher mês`} onClick={() => setView('months')}>
                {capitalize(MONTHS[visible.getMonth()])}
              </button>
              <button type="button" className="gc-title-year" aria-label={`${visible.getFullYear()}, escolher ano`} onClick={() => setView('years')}>
                {visible.getFullYear()}
              </button>
            </>
          )}
          {view === 'months' && (
            <button type="button" className="gc-title-month" aria-label={`${visible.getFullYear()}, escolher ano`} onClick={() => setView('years')}>
              {visible.getFullYear()}
            </button>
          )}
          {view === 'years' && <span className="gc-title-month">Escolha o ano</span>}
        </div>
        {view !== 'years' && (
          <div className="gc-nav">
            <button type="button" aria-label={view === 'days' ? 'Mês anterior' : 'Ano anterior'} disabled={view === 'days' ? !canPrev : visible.getFullYear() <= firstYear} onClick={() => shift(view === 'days' ? -1 : -12)}>
              <ChevronLeft fontSize="small" />
            </button>
            <button type="button" aria-label={view === 'days' ? 'Próximo mês' : 'Próximo ano'} disabled={view === 'days' ? !canNext : visible.getFullYear() >= lastYear} onClick={() => shift(view === 'days' ? 1 : 12)}>
              <ChevronRight fontSize="small" />
            </button>
          </div>
        )}
      </div>

      <div ref={bodyRef} className="gc-body">
        {view === 'days' && (
          <div className="gc-days" onKeyDown={onGridKey}>
            {WEEKDAYS.map((day, index) => <span key={`w${index}`} className="gc-weekday" aria-hidden="true">{day}</span>)}
            {days.map((cell) => {
              if (cell.blank) return <span key={cell.key} aria-hidden="true" />
              const selected = cell.iso === draft
              const isToday = cell.iso === today
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`gc-day${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                  disabled={outOfRange(cell.iso)}
                  aria-label={LONG_DATE.format(cell.date)}
                  aria-pressed={selected}
                  aria-current={isToday ? 'date' : undefined}
                  data-current={selected || (!draft && isToday) ? 'true' : undefined}
                  onClick={() => setDraft(cell.iso)}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
        )}

        {view === 'months' && (
          <div className="gc-months">
            {MONTHS.map((name, index) => {
              const start = new Date(visible.getFullYear(), index, 1)
              const end = new Date(visible.getFullYear(), index + 1, 0)
              const disabled = Boolean((min && dateToISO(end) < min) || (max && dateToISO(start) > max))
              const current = index === visible.getMonth()
              return (
                <button
                  key={name}
                  type="button"
                  className={`gc-cell${current ? ' is-current' : ''}`}
                  disabled={disabled}
                  aria-label={name}
                  data-current={current ? 'true' : undefined}
                  onClick={() => { setVisible(start); setView('days') }}
                >
                  {name.slice(0, 3)}
                </button>
              )
            })}
          </div>
        )}

        {view === 'years' && (
          <div className="gc-years">
            {years.map((year) => {
              const current = year === visible.getFullYear()
              return (
                <button
                  key={year}
                  type="button"
                  className={`gc-cell${current ? ' is-current' : ''}`}
                  data-current={current ? 'true' : undefined}
                  onClick={() => {
                    let month = visible.getMonth()
                    if (minDate && year === minDate.getFullYear()) month = Math.max(month, minDate.getMonth())
                    if (maxDate && year === maxDate.getFullYear()) month = Math.min(month, maxDate.getMonth())
                    setVisible(new Date(year, month, 1))
                    setView('months')
                  }}
                >
                  {year}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {shortcuts.length > 0 && (
        <div className="gc-chips">
          {shortcuts.map((item) => (
            <button key={item.value} type="button" className={draft === item.value ? 'is-active' : ''} onClick={() => pickShortcut(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="gc-foot">
        <button type="button" className="gc-cancel" onClick={onCancel}>Cancelar</button>
        <button type="button" className="gc-apply" disabled={!draft || outOfRange(draft)} onClick={() => onApply(draft)}>Aplicar data</button>
      </div>
    </div>
  )
}
