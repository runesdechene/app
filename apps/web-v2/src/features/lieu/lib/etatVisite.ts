/**
 * QUOI     — l'état du bouton de visite, d'après ma position, ma dernière visite et mon souvenir.
 * POURQUOI — le bouton porte son état avant qu'on le touche : le refus est écrit dessus, jamais
 *            découvert par l'échec (spec fiche §4). Une règle pure, testée seule.
 * ATTENTION — un souvenir (« J'y suis allé », mig 531) n'est pas une visite GPS : de retour sur
 *            place, on visite (jamais « Revendiquer » directement) ; loin, le bouton rappelle le mois.
 */
import { distanceM, libelleDistance, PORTEE_M } from './distance'
import { moisDuSouvenir } from './souvenir'

export type Position = 'inconnue' | 'refusee' | { lat: number; lng: number }

export type EtatVisite =
  | { kind: 'localiser' }
  | { kind: 'refusee' }
  | { kind: 'visiter' }
  | { kind: 'tropLoin'; distance: string }
  | { kind: 'revendiquer' }
  | { kind: 'visite'; le: string; distance: string }
  | { kind: 'souvenir'; mois: string; distance: string }

// Avec l'année : on se souvient en quelle année on y était (Uriel, 28/09).
const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export function etatVisite(
  position: Position,
  lieu: { lat: number; lng: number },
  visiteLe: string | null,
  souvenirLe: string | null = null,
): EtatVisite {
  if (position === 'inconnue') return { kind: 'localiser' }
  if (position === 'refusee') return { kind: 'refusee' }
  const metres = distanceM(position, lieu)
  const aPortee = metres <= PORTEE_M
  if (souvenirLe !== null)
    return aPortee
      ? { kind: 'visiter' }
      : { kind: 'souvenir', mois: moisDuSouvenir(souvenirLe), distance: libelleDistance(metres) }
  if (visiteLe === null)
    return aPortee ? { kind: 'visiter' } : { kind: 'tropLoin', distance: libelleDistance(metres) }
  if (aPortee) return { kind: 'revendiquer' }
  return { kind: 'visite', le: JOUR.format(new Date(visiteLe)), distance: libelleDistance(metres) }
}
