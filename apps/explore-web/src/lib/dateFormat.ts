/** Formatage long FR des dates : "5 mai 2026". Wrap centralisé pour éviter
 *  la duplication des `toLocaleDateString('fr-FR', { day, month: 'long', year })`. */
export function formatFrenchLongDate(input: string | Date | null | undefined): string {
  if (input == null) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Délai relatif court FR : "à l'instant" / "il y a 3 min" / "il y a 3h" /
 *  "il y a 2j". Helper canonique (cf. flux d'Activité). */
export function formatRelativeTime(input: string | Date | null | undefined): string {
  if (input == null) return ''
  const ms = typeof input === 'string' ? new Date(input).getTime() : input.getTime()
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

/**
 * Formatage relatif court (« il y a 15 min », « il y a 3 h », « il y a 2 j »).
 * `nowMs` injectable pour les tests ; défaut = Date.now().
 */
export function formatTimeAgo(iso: string, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000))
  if (diffSec < 60) return "à l'instant"
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} j`
}
