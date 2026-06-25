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

/** Luminance relative WCAG (0 noir → 1 blanc). */
function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

// Fond parchemin de l'app (App.css : #F5E6D3).
const PARCHMENT_LUM = relLuminance([0xF5, 0xE6, 0xD3])

/** Couleur d'« encre » lisible sur le fond parchemin clair, quand une couleur libre
 *  (couleur de Compagnie choisie par le joueur) sert de TEXTE/bordure/accent.
 *  Une couleur trop claire (ex. blanc revendiqué par les Bretons) est foncée par
 *  crans jusqu'à un contraste suffisant ; une couleur déjà foncée est renvoyée telle
 *  quelle. À utiliser pour `color:`/`borderColor:`, PAS pour les pastilles pleines
 *  (là, garder la vraie couleur + `readableTextOn` pour le texte dessus). */
export function readableInk(hex: string, minContrast = 4): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  let c = hex
  for (let i = 0; i < 12; i++) {
    const cur = hexToRgb(c)
    if (!cur || contrastRatio(relLuminance(cur), PARCHMENT_LUM) >= minContrast) break
    c = shade(c, 0.16) // fonce d'un cran vers le noir
  }
  return c
}
