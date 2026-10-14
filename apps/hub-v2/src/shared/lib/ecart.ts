/**
 * QUOI     — l'écart entre un chiffre et celui de la période d'avant, tel qu'on l'écrit sur une tuile.
 * POURQUOI — sous 20, un pourcentage ment (de 2 à 3, « +50 % ») : on écrit l'écart en valeur.
 *            Rien avant → « nouveau » (jamais l'infini). Pas de période d'avant → pas d'écart.
 */
import type { Ecart } from '@/shared/ui/Tuile'

const SEUIL_POURCENTAGE = 20

export function ecart(actuel: number, avant: number | undefined): Ecart | undefined {
  if (avant === undefined) return undefined
  if (actuel === avant) return { texte: '=', sens: 'egal' }
  if (avant === 0) return { texte: 'nouveau', sens: 'hausse' }
  const sens = actuel > avant ? 'hausse' : 'baisse'
  const signe = sens === 'hausse' ? '+' : '−'
  if (avant < SEUIL_POURCENTAGE) return { texte: `${signe}${String(Math.abs(actuel - avant))}`, sens }
  const pourcentage = Math.round((Math.abs(actuel - avant) / avant) * 100)
  if (pourcentage === 0) return { texte: '=', sens: 'egal' }
  return { texte: `${signe}${String(pourcentage)} %`, sens }
}
