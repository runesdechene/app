/**
 * QUOI     — toutes les photos des contributions, avec l'endroit où chacune est publiée (hub_photos, mig 592).
 */
import { supabase } from '@/shared/supabase/client'
import type { StatutContribution } from './contributions'

export type PhotoPubliee = {
  id: string; url: string; contribution: string; nom: string; statut: StatutContribution; quand: string | null
  produit_titre: string | null; fiche: boolean; mur: boolean; communaute: boolean
}

export async function lirePhotos(): Promise<PhotoPubliee[]> {
  const { data, error } = await supabase.rpc('hub_photos')
  if (error) throw new Error(error.message)
  return data as PhotoPubliee[]
}
