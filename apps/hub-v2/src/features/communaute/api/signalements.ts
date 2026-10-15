/**
 * QUOI     — la file des signalements en attente (mod_signalements) et la décision « traité ».
 * POURQUOI — la lecture lève en 42501 hors équipe : le message de la base remonte tel quel.
 */
import { supabase } from '@/shared/supabase/client'

export type Signalement = {
  id: number
  raison: string
  precision: string | null
  quand: string
  lieu: { id: string; nom: string; masque: boolean }
  qui: { id: string; nom: string }
}

export async function lireSignalements(): Promise<Signalement[]> {
  const { data, error } = await supabase.rpc('mod_signalements')
  if (error) throw new Error(error.message)
  return data as Signalement[]
}

export async function traiterSignalement(id: number): Promise<void> {
  const { error } = await supabase.rpc('mod_traiter_signalement', { p_id: id })
  if (error) throw new Error(error.message)
}
