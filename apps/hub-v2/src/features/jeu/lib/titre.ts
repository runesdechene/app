/**
 * QUOI     — les titres des joueurs : les quatre chemins, le genre d'un titre, ce qui s'en lit.
 * POURQUOI — seule la condition d'un titre de chemin (stat, seuil) se modifie ici ; celle d'une
 *            connaissance (culture, palier) ou du polymathe est tenue par le jeu et ne part jamais à l'écriture.
 */
import type { Json } from '@/shared/supabase/database.types'

export const CHEMINS: Record<string, string> = {
  level: 'Niveau', places_visited: 'Lieux visités sur place', places_added: 'Lieux ajoutés', places_enriched: 'Lieux enrichis',
}

export type Genre = 'chemin' | 'connaissance' | 'polymathe' | 'autre'
export type Condition = { stat?: string; min?: number; theme?: string; palier?: number }
type AvecCondition = { type: string; condition: Json }

export function lireCondition(condition: Json): Condition {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) return {}
  const { stat, min, theme, palier } = condition
  return {
    ...(typeof stat === 'string' && { stat }),
    ...(typeof min === 'number' && { min }),
    ...(typeof theme === 'string' && { theme }),
    ...(typeof palier === 'number' && { palier }),
  }
}

export function genreDeTitre(t: AvecCondition): Genre {
  const { stat } = lireCondition(t.condition)
  if (stat === 'connaissance') return 'connaissance'
  if (stat === 'polymathe') return 'polymathe'
  if (t.type === 'general' && stat !== undefined && stat in CHEMINS) return 'chemin'
  return 'autre'
}

export const conditionModifiable = (t: AvecCondition) => genreDeTitre(t) === 'chemin'

// La condition d'un titre, en clair, pour les titres dont elle ne se modifie pas.
export function libelleDeCondition(condition: Json): string {
  const { stat, theme, palier } = lireCondition(condition)
  if (stat === 'connaissance') return `Connaissance ${theme ?? '?'}, palier ${palier === undefined ? '?' : String(palier)}`
  if (stat === 'polymathe') return 'Polymathe : toutes les connaissances'
  return stat ? `Condition : ${stat}` : 'Sans condition'
}
