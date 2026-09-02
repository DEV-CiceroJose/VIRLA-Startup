const DAY_MS = 86_400_000

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) return null
  return formatDateOnly(date) === String(value) ? date : null
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

export function calculateContractAmountCents({ hourlyRate, startedAt, endedAt }) {
  const rate = Number(hourlyRate)
  const [startHour, startMinute] = String(startedAt).split(':').map(Number)
  const [endHour, endMinute] = String(endedAt).split(':').map(Number)
  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isInteger(minutes) || minutes <= 0) return null
  return Math.round((rate * minutes * 100) / 60)
}

export function calculatePaymentDueDate({ contractStartDate, serviceDate, paymentRecurrence }) {
  const start = parseDateOnly(contractStartDate)
  const service = parseDateOnly(serviceDate)
  if (!start || !service) return null

  if (paymentRecurrence === 'DIARIA') return formatDateOnly(service)

  if (paymentRecurrence === 'SEMANAL') {
    const elapsedDays = Math.max(0, Math.floor((service.getTime() - start.getTime()) / DAY_MS))
    const cycleNumber = Math.max(1, Math.ceil(elapsedDays / 7))
    const cycleEnd = new Date(start.getTime() + cycleNumber * 7 * DAY_MS)
    return formatDateOnly(cycleEnd)
  }

  if (paymentRecurrence === 'MENSAL') {
    const anchorDay = start.getUTCDate()
    const monthlyDue = (year, month) => {
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay)))
    }
    let due = monthlyDue(service.getUTCFullYear(), service.getUTCMonth())
    const serviceIsInStartMonth = service.getUTCFullYear() === start.getUTCFullYear()
      && service.getUTCMonth() === start.getUTCMonth()
    if (due < service || serviceIsInStartMonth) {
      due = monthlyDue(service.getUTCFullYear(), service.getUTCMonth() + 1)
    }
    return formatDateOnly(due)
  }

  return null
}

export function todayDateOnly(timeZone = process.env.BUSINESS_TIME_ZONE ?? 'America/Fortaleza') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function paymentIsDue(paymentDueDate, today = todayDateOnly()) {
  return !paymentDueDate || paymentDueDate <= today
}
