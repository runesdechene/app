/** Met une majuscule à la première lettre (le reste inchangé). '' → ''. */
export function capitalizeFirst(s: string | null | undefined): string {
  const v = (s ?? '').trim()
  if (!v) return ''
  return v.charAt(0).toUpperCase() + v.slice(1)
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
