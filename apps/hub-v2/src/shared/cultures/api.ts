/**
 * QUOI     — lit les cultures du Hub (cultures_du_hub), une seule fois pour tout le Hub.
 * POURQUOI — le Jeu les règle, la Boutique les montre : la lecture n'appartient à aucun des deux.
 */
import { supabase } from '@/shared/supabase/client'

export type Cercle = { lat: number; lng: number; rayon_km: number }

export type CultureDuHub = {
  id: string; label: string; couleur: string | null; icone: string | null; complement: string | null
  zone: string | null; presentation: string | null; cercles: Cercle[]; active: boolean; ordre: number
  stock: number; total: number; eveils: { lat: number; lng: number }[]
}

export async function lireCulturesDuHub(): Promise<CultureDuHub[]> {
  const { data, error } = await supabase.rpc('cultures_du_hub')
  if (error) throw new Error(error.message)
  return data as CultureDuHub[]
}
