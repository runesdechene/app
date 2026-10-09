/**
 * QUOI     — met en phrase la condition d'un titre (`titles.condition` : { stat, min }).
 * POURQUOI — toucher un titre sur un profil explique comment il a été gagné (décision d'Uriel,
 *            27/09) : « Débloqué en visitant 50 lieux sur place. » Une statistique inconnue
 *            reste honnête : « Gagné en jouant. »
 */
import { chaine, nombre, objet } from '@/shared/lib/lire'

export type ConditionTitre = { stat: string; min: number }

// Chaque chemin vivant (migration 433), en français d'Explorateur : n → fin de phrase.
const PHRASES: Record<string, (n: number) => string> = {
  level: (n) => `en atteignant le niveau ${String(n)}`,
  places_visited: (n) => `en visitant ${lieux(n)} sur place`,
  places_added: (n) => `en ajoutant ${lieux(n)}`,
  places_enriched: (n) => `en enrichissant ${lieux(n)}`,
}

function lieux(n: number): string {
  return `${String(n)} ${n > 1 ? 'lieux' : 'lieu'}`
}

export function phraseCondition(condition: ConditionTitre | null): string {
  if (!condition) return 'Gagné en jouant.'
  const phrase = PHRASES[condition.stat]
  return phrase ? `Débloqué ${phrase(condition.min)}.` : 'Gagné en jouant.'
}

// Une condition illisible ne fait pas tomber l'écran : le titre s'affiche, son origine se dit
// alors « Gagné en jouant ».
export function lireCondition(v: unknown): ConditionTitre | null {
  try {
    const o = objet(v)
    return { stat: chaine(o.stat), min: nombre(o.min) }
  } catch {
    return null
  }
}
