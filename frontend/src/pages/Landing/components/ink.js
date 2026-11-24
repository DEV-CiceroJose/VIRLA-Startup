// Geometria da mancha de tinta (adaptada do "Ink Spill Theme Switch", 21st.dev).
// Uma mancha em forma de estrela: borda com ruído fractal, filetes finos e
// gotas que caem logo à frente e são engolidas. Sem React e sem DOM.

const TAU = Math.PI * 2
const FREQS = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233]
const ROUGH = 0.22 // amplitude somada da borda, em fração de R

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeInk(seed) {
  const r = mulberry32(seed)
  const harmonics = FREQS.map((k) => [k, (0.6 + r() * 0.8) / Math.pow(k, 0.55), r() * TAU, (r() - 0.5) * 9])
  let sum = 0
  for (const h of harmonics) sum += h[1]
  for (const h of harmonics) h[1] *= ROUGH / sum
  const tendrils = []
  for (let i = 0; i < 70; i++) tendrils.push([r() * TAU, 0.005 + r() * 0.018, 0.015 + Math.pow(r(), 1.6) * 0.14, r() * 0.7])
  for (let i = 0; i < 9; i++) tendrils.push([r() * TAU, 0.014 + r() * 0.03, 0.12 + r() * 0.22, r() * 0.45])
  const drops = []
  for (let i = 0; i < 130; i++) drops.push([r() * TAU, 0.05 + r() * 1.0, 0.0012 + Math.pow(r(), 2.6) * 0.009, 1 + r() * 2.2])
  return { harmonics, tendrils, drops, dip: ROUGH }
}

function wrap(a) {
  a = a % TAU
  return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a
}

function rimAt(ink, a, R, p) {
  let n = 0
  for (const h of ink.harmonics) n += h[1] * Math.sin(h[0] * a + h[2] + h[3] * p)
  let spike = 0
  for (const t of ink.tendrils) {
    const grow = Math.min(1, Math.max(0, (p - t[3]) / 0.3))
    if (grow <= 0) continue
    const d = wrap(a - t[0]) / t[1]
    if (d > 3 || d < -3) continue
    spike += t[2] * grow * Math.exp(-d * d)
  }
  return R * (1 + n + spike)
}

/** Raio que garante tinta em todos os cantos de uma caixa w × h a partir de (ox, oy). */
export function coverRadius(ink, ox, oy, w, h) {
  const far = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy))
  return (far / (1 - ink.dip)) * 1.02
}

function easeSpill(p) {
  const out = 1 - Math.pow(1 - p, 3)
  const smooth = p * p * (3 - 2 * p)
  return out * 0.55 + smooth * 0.45
}

/** Caminho (SVG/CSS path) da mancha e das gotas no progresso p (0..1). */
export function inkPath(ink, ox, oy, Rend, p, steps = 720) {
  const R = Rend * easeSpill(p)
  if (R <= 0.5) return ''
  let d = ''
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU
    const r = rimAt(ink, a, R, p)
    d += (i ? 'L' : 'M') + (ox + r * Math.cos(a)).toFixed(1) + ' ' + (oy + r * Math.sin(a)).toFixed(1)
  }
  d += 'Z'
  for (const k of ink.drops) {
    const dist = k[1] * Rend
    const born = (R - dist * 0.8) / (dist * 0.12)
    if (born <= 0) continue
    const ry = Math.max(0.6, k[2] * Rend * Math.min(1, born))
    const rx = ry * k[3]
    const c = Math.cos(k[0])
    const s = Math.sin(k[0])
    const x = ox + dist * c
    const y = oy + dist * s
    const rot = ((k[0] * 180) / Math.PI).toFixed(1)
    const head = (x + rx * c).toFixed(1) + ' ' + (y + rx * s).toFixed(1)
    const tail = (x - rx * c).toFixed(1) + ' ' + (y - rx * s).toFixed(1)
    const radii = rx.toFixed(1) + ' ' + ry.toFixed(1) + ' ' + rot
    d += 'M' + head + 'A' + radii + ' 1 1 ' + tail + 'A' + radii + ' 1 1 ' + head + 'Z'
  }
  return d
}
