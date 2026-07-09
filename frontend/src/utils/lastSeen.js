/** Zero à esquerda em números de 1 dígito. */
function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Verdadeiro se as duas datas caem no mesmo dia civil (local). */
function sameCivilDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * "Visto por último" em pt-BR, relativo a `nowMs`.
 * '' | 'agora mesmo' | 'há N min' | 'hoje às HH:MM' | 'ontem às HH:MM' | 'DD/MM às HH:MM'
 */
export function formatLastSeen(ms, nowMs = Date.now()) {
  if (ms == null || Number.isNaN(Number(ms))) return ''
  const diff = nowMs - ms
  if (diff < 60_000) return 'agora mesmo'
  if (diff < 3_600_000) return `há ${Math.max(1, Math.floor(diff / 60_000))} min`

  const then = new Date(ms)
  const now = new Date(nowMs)
  const hhmm = `${pad2(then.getHours())}:${pad2(then.getMinutes())}`

  if (sameCivilDay(then, now)) return `hoje às ${hhmm}`

  const yesterday = new Date(nowMs)
  yesterday.setDate(now.getDate() - 1)
  if (sameCivilDay(then, yesterday)) return `ontem às ${hhmm}`

  return `${pad2(then.getDate())}/${pad2(then.getMonth() + 1)} às ${hhmm}`
}
