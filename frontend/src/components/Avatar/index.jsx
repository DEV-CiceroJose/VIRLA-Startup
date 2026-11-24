/** Avatar com foto ou iniciais — usado no shell e no painel. */
function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

export default function Avatar({ src, name, size = 40, radius = 12, className = '' }) {
  return (
    <span
      className={`vd-avatar ${className}`}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.max(11, Math.round(size / 3)) }}
      aria-hidden
    >
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  )
}
