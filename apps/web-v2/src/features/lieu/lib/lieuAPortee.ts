/**
 * QUOI     — le lieu que la carte propose de visiter : le plus proche à portée, que je ne tiens pas.
 * POURQUOI — spec « Revendiquer par GPS » : sur place, la carte pousse à marquer la visite, puis à
 *            revendiquer. Une curiosité se visite mais ne se revendique pas : elle n'est pas proposée.
 */
import type { Position } from '@/shared/hooks/usePosition'
import { distanceM, libelleDistance, PORTEE_M } from './distance'

// Ce qu'il faut savoir d'un lieu de la carte pour le proposer (un `LieuCarte` convient tel quel).
export type LieuProche = {
  id: string
  nom: string
  lat: number
  lng: number
  nature: 'lieu' | 'curiosite'
  revendication: { moi: boolean } | null
}

export function lieuAPortee<L extends LieuProche>(position: Position, lieux: L[]) {
  if (typeof position === 'string') return null
  let proche: { lieu: L; metres: number } | null = null
  for (const lieu of lieux) {
    if (lieu.nature !== 'lieu' || lieu.revendication?.moi === true) continue
    const metres = distanceM(position, lieu)
    if (metres <= PORTEE_M && (proche === null || metres < proche.metres)) proche = { lieu, metres }
  }
  return proche && { lieu: proche.lieu, distance: libelleDistance(proche.metres) }
}
