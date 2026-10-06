/**
 * QUOI     — ce qu'on dit d'un chemin de titres : son nom (« Les visites »), son compteur en clair
 *            (« 60 lieux visités »), et le prochain titre à gagner.
 * POURQUOI — la base range les chemins ; ici, seulement les mots (maquette 112:107).
 */
import type { Chemin, TitreDuChemin } from '../api/lireMesTitres'

const NOMS: Record<string, string> = {
  level: 'Le chemin',
  places_visited: 'Les visites',
  places_added: 'Les lieux ajoutés',
  places_enriched: 'Les lieux enrichis',
}

const UNITES: Record<string, [string, string]> = {
  places_visited: ['lieu visité', 'lieux visités'],
  places_added: ['lieu ajouté', 'lieux ajoutés'],
  places_enriched: ['lieu enrichi', 'lieux enrichis'],
}

export function nomDuChemin(stat: string): string {
  return NOMS[stat] ?? stat
}

export function compteurEnClair(stat: string, n: number): string {
  if (stat === 'level') return `niveau ${String(n)}`
  const unite = UNITES[stat]
  if (!unite) return String(n)
  return `${String(n)} ${n > 1 ? unite[1] : unite[0]}`
}

// Où on en est vers un seuil : « 60 / 150 lieux visités », « niveau 12 / 15 ».
export function progresEnClair(stat: string, compteur: number, min: number): string {
  if (stat === 'level') return `niveau ${String(compteur)} / ${String(min)}`
  return `${String(compteur)} / ${compteurEnClair(stat, min)}`
}

// Le premier titre pas encore obtenu, ou null si tout le chemin est gagné.
export function prochain(chemin: Chemin): TitreDuChemin | null {
  return chemin.titres.find((t) => !t.obtenu) ?? null
}
