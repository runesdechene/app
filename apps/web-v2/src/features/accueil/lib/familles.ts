/**
 * QUOI     — le filtre de « Sur les chemins » : trois familles de lignes (Lieux, Gens, Énigmes),
 *            qu'on allume ou éteint, et le choix gardé sur l'appareil.
 * POURQUOI — Uriel, 11/10 : les énigmes percées prennent beaucoup de place dans le fil ; on doit
 *            pouvoir les retirer. Une famille au moins reste allumée : le fil n'est jamais vidé par
 *            le filtre. Un choix illisible rend tout allumé.
 */
import type { TypeDeChemin } from '../api/lireAccueil'

export type Famille = 'lieux' | 'gens' | 'enigmes'

export const FAMILLES: readonly { id: Famille; libelle: string }[] = [
  { id: 'lieux', libelle: 'Lieux' },
  { id: 'gens', libelle: 'Gens' },
  { id: 'enigmes', libelle: 'Énigmes' },
]
export const TOUTES: ReadonlySet<Famille> = new Set(FAMILLES.map((f) => f.id))

const FAMILLE_DE: Record<TypeDeChemin, Famille> = {
  visite: 'lieux',
  ajout: 'lieux',
  revendication: 'lieux',
  enrichi: 'lieux',
  modifie: 'lieux',
  arrivee: 'gens',
  fondation: 'gens',
  adhesion: 'gens',
  enigme: 'enigmes',
}

export function filtrerChemins<T extends { type: TypeDeChemin }>(
  chemins: T[],
  allumees: ReadonlySet<Famille>,
): T[] {
  return chemins.filter((c) => allumees.has(FAMILLE_DE[c.type]))
}

export function basculerFamille(allumees: ReadonlySet<Famille>, f: Famille): ReadonlySet<Famille> {
  const apres = new Set(allumees)
  if (apres.has(f)) apres.delete(f)
  else apres.add(f)
  return apres.size > 0 ? apres : allumees
}

const CLE = 'explore-v2:chemins:familles'
const estFamille = (v: unknown): v is Famille => FAMILLES.some((f) => f.id === v)

export function lireFamilles(
  stockage: { getItem: (cle: string) => string | null } | null,
): ReadonlySet<Famille> {
  try {
    const brut: unknown = JSON.parse(stockage?.getItem(CLE) ?? 'null')
    const allumees = Array.isArray(brut) ? brut.filter(estFamille) : []
    return allumees.length > 0 ? new Set(allumees) : TOUTES
  } catch {
    return TOUTES
  }
}

export function garderFamilles(
  stockage: { setItem: (cle: string, valeur: string) => void } | null,
  allumees: ReadonlySet<Famille>,
) {
  try {
    stockage?.setItem(CLE, JSON.stringify([...allumees]))
  } catch {
    // Stockage plein ou refusé (navigation privée) : le choix vaut pour cette fois.
  }
}
