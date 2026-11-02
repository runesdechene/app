/**
 * QUOI     — ce que rend `tirer_anecdote` (migration 579) : l'anecdote tirée (ou rien), pourquoi,
 *            ce qui reste, et si c'est le premier scan de ce motif (la découverte animée).
 */
import { booleen, nombre, objet, ouNull } from '@/shared/lib/lire'
import { lireAnecdote, type AnecdoteTrouvee } from './lireMonFragment'

export type Raison = 'gratuite' | 'creusee' | 'deja_aujourdhui' | 'toutes_trouvees'

export type Tirage = {
  anecdote: AnecdoteTrouvee | null
  raison: Raison
  restantes: number
  raresRestantes: number
  premiereDecouverte: boolean
}

const RAISONS: readonly Raison[] = ['gratuite', 'creusee', 'deja_aujourdhui', 'toutes_trouvees']

export function lireTirage(v: unknown): Tirage {
  const o = objet(v)
  const raison = RAISONS.find((r) => r === o.raison)
  if (!raison) throw new Error(`raison inconnue : ${String(o.raison)}`)
  return {
    anecdote: ouNull(lireAnecdote)(o.anecdote),
    raison,
    restantes: nombre(o.restantes),
    raresRestantes: nombre(o.raresRestantes),
    premiereDecouverte: booleen(o.premiereDecouverte),
  }
}
