/**
 * QUOI     — tirer une anecdote d'un motif : la gratuite du jour après un scan, ou une de plus en
 *            creusant (2 énergies) — `tirer_anecdote`, migration 579.
 *            Sans compte, `anecdoteAuHasard` en lit une, sans rien garder (migration 583).
 * POURQUOI — le serveur décide de tout ; son refus faute d'énergie (code RDC01, comme la découverte
 *            d'un lieu) devient `PasAssezDEnergie`, que l'écran dit en mots.
 */
import { supabase } from '@/shared/supabase/client'
import { ouNull } from '@/shared/lib/lire'
import { lireAnecdote } from './lireMonFragment'
import { lireTirage } from './lireTirage'

export class PasAssezDEnergie extends Error {}

export async function tirerAnecdote(fragment: number, creuser: boolean) {
  const { data, error } = await supabase.rpc('tirer_anecdote', {
    p_fragment: fragment,
    p_creuser: creuser,
  })
  if (error) {
    if (error.code === 'RDC01') throw new PasAssezDEnergie(error.message)
    throw error
  }
  return lireTirage(data)
}

export async function anecdoteAuHasard(fragment: number) {
  const { data, error } = await supabase.rpc('anecdote_au_hasard', { p_fragment: fragment })
  if (error) throw error
  return ouNull(lireAnecdote)(data)
}
