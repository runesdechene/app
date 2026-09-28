/**
 * QUOI     — l'état du bouton de visite, d'après ma position et ma dernière visite.
 * POURQUOI — le bouton porte son état avant qu'on le touche : le refus est écrit dessus, jamais
 *            découvert par l'échec (spec fiche §4). Une règle pure, testée seule.
 */
import { distanceM, libelleDistance, PORTEE_M } from './distance'

export type Position = 'inconnue' | 'refusee' | { lat: number; lng: number }

export type EtatVisite =
  | { kind: 'localiser' }
  | { kind: 'refusee' }
  | { kind: 'visiter' }
  | { kind: 'tropLoin'; distance: string }
  | { kind: 'revendiquer' }
  | { kind: 'visite'; le: string; distance: string }

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

export function etatVisite(
  position: Position,
  lieu: { lat: number; lng: number },
  visiteLe: string | null,
): EtatVisite {
  if (position === 'inconnue') return { kind: 'localiser' }
  if (position === 'refusee') return { kind: 'refusee' }
  const metres = distanceM(position, lieu)
  const aPortee = metres <= PORTEE_M
  if (visiteLe === null) return aPortee ? { kind: 'visiter' } : { kind: 'tropLoin', distance: libelleDistance(metres) }
  if (aPortee) return { kind: 'revendiquer' }
  return { kind: 'visite', le: JOUR.format(new Date(visiteLe)), distance: libelleDistance(metres) }
}
