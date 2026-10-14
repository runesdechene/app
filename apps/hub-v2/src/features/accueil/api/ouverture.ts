/**
 * QUOI     — lit l'ouverture du Hub (hub_ouverture, mig 506) pour une période.
 * POURQUOI — une seule lecture pour l'en-tête, le pouls, l'attente et la santé.
 */
import { supabase } from '@/shared/supabase/client'

export type Periode = '1' | '7' | '30' | '90'
export type Compteurs = { nouveaux: number; reactives: number; lieux: number; visites: number; enigmes: number }
export type Ouverture = {
  pouls: Compteurs & { actifs: number }
  avant: Compteurs
  attente: {
    photos: number; photos_depuis: string | null; lieux: number
    signalements_lieu: number; signalements_enigme: number; achats: number
  }
  sante: { derniere_commande: string | null; notifications: number; notifications_lues: number }
}

export async function lireOuverture(periode: Periode): Promise<Ouverture> {
  const { data, error } = await supabase.rpc('hub_ouverture', { p_jours: Number(periode) })
  if (error) throw error
  return data as Ouverture
}
