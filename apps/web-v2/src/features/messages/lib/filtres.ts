/**
 * QUOI     — les gélules à cocher du Registre : les deux canaux où l'on écrit, et « Activité »
 *            (les nouveaux comptes, et plus tard d'autres annonces) qu'on lit seulement ; et le
 *            choix gardé sur l'appareil.
 * POURQUOI — Uriel, 05/10 : « certains pourraient vouloir le désactiver » — un canal décoché le
 *            reste à la prochaine ouverture. Un choix illisible ou vide rend tout coché : le
 *            Registre ne s'ouvre jamais vide.
 */
import { CANAUX, type Canal } from '../api/lireRegistre'

export type Filtre = Canal | 'activite'
export const FILTRES: readonly Filtre[] = [...CANAUX, 'activite']

const CLE = 'explore-v2:registre:filtres'

export function lireFiltres(stockage: { getItem: (cle: string) => string | null } | null) {
  try {
    const brut: unknown = JSON.parse(stockage?.getItem(CLE) ?? 'null')
    const gardes = Array.isArray(brut) ? FILTRES.filter((f) => brut.includes(f)) : []
    return new Set<Filtre>(gardes.length > 0 ? gardes : FILTRES)
  } catch {
    return new Set<Filtre>(FILTRES)
  }
}

export function garderFiltres(
  stockage: { setItem: (cle: string, valeur: string) => void } | null,
  filtres: ReadonlySet<Filtre>,
) {
  try {
    stockage?.setItem(CLE, JSON.stringify([...filtres]))
  } catch {
    // Stockage plein ou refusé (navigation privée) : le choix vaut pour cette fois.
  }
}
