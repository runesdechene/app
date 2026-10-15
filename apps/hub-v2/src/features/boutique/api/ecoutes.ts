/**
 * QUOI     — lit les écoutes de voix off, une ligne par Fragment (get_fragment_audio_stats, mig 343).
 * POURQUOI — la fonction est gardée (staff) : elle rend zéro ligne à un non-staff. `taux`, `progression` et
 *            `derniere_ecoute` sont nuls quand rien ne les fonde, même si les types générés les disent pleins.
 */
import { supabase } from '@/shared/supabase/client'

export type EcouteDUnFragment = {
  illustration_handle: string; ecoutes: number; completions: number; taux: number | null
  progression: number | null; mesurables: number; ecoutes_motif: number; ecoutes_produit: number
  derniere_ecoute: string | null
}

export async function lireEcoutes(): Promise<EcouteDUnFragment[]> {
  const { data, error } = await supabase.rpc('get_fragment_audio_stats')
  if (error) throw new Error(error.message)
  return data
}
