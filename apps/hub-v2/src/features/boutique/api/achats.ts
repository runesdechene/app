/**
 * QUOI     — la file des achats à associer (pending et no_match) et les deux gestes sur une ligne no_match :
 *            lui associer un Fragment, ou la classer « rien à débloquer ».
 * POURQUOI — la base décide (elle refuse un achat qui n'attend pas, ou sans compte) : son message remonte tel quel.
 */
import { supabase } from '@/shared/supabase/client'

export type Achat = {
  id: number; quand: string | null; statut: 'pending' | 'no_match'; email: string | null
  commande: string | null; tag: string | null; fragment: number | null; compte: { id: string; nom: string } | null
}

export async function lireAchats(): Promise<Achat[]> {
  const { data, error } = await supabase.rpc('hub_achats')
  if (error) throw new Error(error.message)
  return data as Achat[]
}

export async function associerAchat(id: number, fragment: number): Promise<void> {
  const { error } = await supabase.rpc('hub_associer_achat', { p_achat: id, p_fragment: fragment })
  if (error) throw new Error(error.message)
}

export async function classerAchat(id: number): Promise<void> {
  const { error } = await supabase.rpc('hub_classer_achat', { p_achat: id })
  if (error) throw new Error(error.message)
}
