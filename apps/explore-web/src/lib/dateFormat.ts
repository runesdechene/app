/** Formatage long FR des dates : "5 mai 2026". Wrap centralisé pour éviter
 *  la duplication des `toLocaleDateString('fr-FR', { day, month: 'long', year })`. */
export function formatFrenchLongDate(input: string | Date | null | undefined): string {
  if (input == null) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Délai relatif court FR : "à l'instant" / "il y a 3 min" / "il y a 3h" /
 *  "il y a 2j". Helper canonique (cf. flux d'Activité). */
export function formatRelativeTime(input: string | Date | null | undefined, nowMs: number = Date.now()): string {
  if (input == null) return ''
  const ms = typeof input === 'string' ? new Date(input).getTime() : input.getTime()
  const diff = nowMs - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}
