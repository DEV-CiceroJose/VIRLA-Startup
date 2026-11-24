// Datas "puras" (sem fuso) no formato ISO AAAA-MM-DD, usadas pelo calendário.

const pad = (n) => String(n).padStart(2, '0')

export function dateToISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dateFromISO(value) {
  const [year, month, day] = String(value || '').split('T')[0].split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

export function todayISO() {
  return dateToISO(new Date())
}

export function addDays(iso, days) {
  const date = dateFromISO(iso)
  if (!date) return ''
  date.setDate(date.getDate() + days)
  return dateToISO(date)
}

/** dd/mm/aaaa */
export function formatDate(value) {
  const date = dateFromISO(value)
  return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : ''
}
