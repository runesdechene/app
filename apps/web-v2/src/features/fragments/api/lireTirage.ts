/**
 * QUOI     — ce que rend `tirer_anecdote` (migration 579) : l'anecdote tirée (ou rien), pourquoi,
 *            ce qui reste, si c'est le premier scan de ce motif (la découverte animée), et sa place
 *            dans sa collection (« 2 sur 5 de La Garde d'Acier », migration 581).
 */
import { booleen, chaine, nombre, objet, ouNull } from '@/shared/lib/lire'
import { lireAnecdote, type AnecdoteTrouvee } from './lireMonFragment'

export type Raison = 'gratuite' | 'creusee' | 'deja_aujourdhui' | 'toutes_trouvees'

export type Tirage = {
  anecdote: AnecdoteTrouvee | null
  raison: Raison
  restantes: number
  raresRestantes: number
  premiereDecouverte: boolean
  collection: { nom: string; connus: number; total: number } | null
}

const RAISONS: readonly Raison[] = ['gratuite', 'creusee', 'deja_aujourdhui', 'toutes_trouvees']

function lireCollection(v: unknown) {
  const o = objet(v)
  return { nom: chaine(o.nom), connus: nombre(o.connus), total: nombre(o.total) }
}

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
    // Avant la migration 581, la clé manque.
    collection: ouNull(lireCollection)(o.collection ?? null),
  }
}
