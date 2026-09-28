/**
 * QUOI     — « il y a 10 min », « il y a 3 h », « hier », « il y a 4 jours ».
 * POURQUOI — le fil dit quand, pas une date : c'est ce qui le rend vivant. Le navigateur sait
 *            déjà l'écrire en français (Intl.RelativeTimeFormat) ; on choisit seulement l'unité.
 */
const RELATIF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto', style: 'short' })

const MINUTE = 60 * 1000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

export function ilYA(quand: string, maintenant = Date.now()): string {
  const ecart = maintenant - new Date(quand).getTime()
  if (ecart < MINUTE) return 'à l’instant'
  if (ecart < HEURE) return RELATIF.format(-Math.floor(ecart / MINUTE), 'minute')
  if (ecart < JOUR) return RELATIF.format(-Math.floor(ecart / HEURE), 'hour')
  return RELATIF.format(-Math.floor(ecart / JOUR), 'day')
}
