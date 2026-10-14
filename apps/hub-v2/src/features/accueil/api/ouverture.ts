/**
 * QUOI     — lit l'ouverture du Hub (hub_ouverture, mig 506, par période calendaire depuis la mig 510) pour une période.
 * POURQUOI — une seule lecture pour l'en-tête, le pouls, l'attente et la santé.
 * ATTENTION — `avant` est null pour « toujours » : pas de période d'avant à comparer.
 */
import { supabase } from '@/shared/supabase/client'

export type Periode = 'jour' | 'semaine' | 'mois' | 'toujours'
export type Compteurs = { nouveaux: number; reactives: number; lieux: number; visites: number; enigmes: number }
export type Ouverture = {
  pouls: Compteurs & { actifs: number }
  avant: Compteurs | null
  attente: {
    photos: number; photos_depuis: string | null; lieux: number
    signalements_lieu: number; signalements_enigme: number; achats: number
  }
  sante: { derniere_commande: string | null; notifications: number; notifications_lues: number }
}

export async function lireOuverture(periode: Periode): Promise<Ouverture> {
  const { data, error } = await supabase.rpc('hub_ouverture', { p_periode: periode })
  if (error) throw error
  return data as Ouverture
}
