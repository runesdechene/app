/**
 * QUOI     — les anecdotes d'un Fragment : les lire, en écrire une (ajout, correction, masquer).
 * POURQUOI — elles se gagnent en scannant le motif (spec du Codex, 02/11) ; la boutique ne les montre
 *            pas, elles vivent en base (migration 579), écrites par des fonctions réservées à l'équipe.
 */
import { supabase } from '@/shared/supabase/client'

export type Rarete = 'commune' | 'peu_commune' | 'rare'
export type Anecdote = { id: number; texte: string; rarete: Rarete; visible: boolean; trouvee: number }

export async function lireAnecdotes(fragment: number): Promise<Anecdote[]> {
  const { data, error } = await supabase.rpc('hub_anecdotes', { p_fragment: fragment })
  if (error) throw new Error(error.message)
  return data as Anecdote[]
}

export async function ecrireAnecdote(a: { id: number | null; fragment: number; texte: string; rarete: Rarete; visible: boolean }): Promise<number> {
  const { data, error } = await supabase.rpc('hub_ecrire_anecdote', {
    // Sans id, la fonction ajoute ; avec, elle corrige.
    p_id: a.id as number, p_fragment: a.fragment, p_texte: a.texte, p_rarete: a.rarete, p_visible: a.visible,
  })
  if (error) throw new Error(error.message)
  return data
}
