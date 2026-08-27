const DAY_MS = 86_400_000

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return toDateOnly(date) === String(value) ? date : null
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

export function todayDateOnly() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
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
  if (paymentRecurrence === 'DIARIA') return toDateOnly(service)
  if (paymentRecurrence === 'SEMANAL') {
    const elapsedDays = Math.max(0, Math.floor((service.getTime() - start.getTime()) / DAY_MS))
    const cycleNumber = Math.max(1, Math.ceil(elapsedDays / 7))
    return toDateOnly(new Date(start.getTime() + cycleNumber * 7 * DAY_MS))
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
    return toDateOnly(due)
  }
  return null
}

export function daysUntilPayment(paymentDueDate, today = todayDateOnly()) {
  const due = parseDateOnly(paymentDueDate)
  const current = parseDateOnly(today)
  if (!due || !current) return null
  return Math.max(0, Math.ceil((due.getTime() - current.getTime()) / DAY_MS))
}

export function paymentCountdownLabel(paymentDueDate, today) {
  const days = daysUntilPayment(paymentDueDate, today)
  if (days == null) return ''
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return `daqui a ${days} dias`
}
