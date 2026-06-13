/** Met une majuscule à la première lettre (le reste inchangé). '' → ''. */
export function capitalizeFirst(s: string | null | undefined): string {
  const v = (s ?? '').trim()
  if (!v) return ''
  return v.charAt(0).toUpperCase() + v.slice(1)
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '')
  if (h.length < 6) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function toHex(n: number): string { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0') }

/** Version pastel (adoucie) d'une couleur : mélange vers le blanc (t=0.8 par défaut). */
export function pastel(hex: string, t = 0.8): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const [r, g, b] = rgb
  return `#${toHex(r + (255 - r) * t)}${toHex(g + (255 - g) * t)}${toHex(b + (255 - b) * t)}`
}

/** Version foncée d'une couleur : mélange vers le noir (t=0.45 par défaut). Pour le texte. */
export function shade(hex: string, t = 0.45): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const [r, g, b] = rgb
  return `#${toHex(r * (1 - t))}${toHex(g * (1 - t))}${toHex(b * (1 - t))}`
}

/** Couleur de texte lisible (sombre/clair) sur un fond hex donné, selon sa luminance.
 *  Évite le texte blanc illisible sur des couleurs claires (ex. doré #F4B400). */
export function readableTextOn(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#fff'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#3d2f20' : '#fff'
}
