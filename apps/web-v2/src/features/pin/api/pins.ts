/**
 * QUOI     — les appels du pin GPS : poser, lister, supprimer, les lieux proches, « C'est lui ».
 * POURQUOI — fonctions de la migration 428 ; toutes lisent `auth.uid()` (jamais d'id envoyé).
 *            Supprimer passe par la règle RLS de la table (`drafts_delete_own`, mig 264).
 */
import { supabase } from '@/shared/supabase/client'
import { booleen, objet } from '@/shared/lib/lire'
import type { PinEnAttente } from '../lib/pinsEnAttente'
import { lireLieuxProches, lireMesPins, type LieuProche, type MesPins } from './lirePins'

export async function poserPin(p: PinEnAttente, lieuDit: string | null): Promise<void> {
  const { error } = await supabase.rpc('poser_pin', {
    p_id: p.id,
    p_latitude: p.latitude,
    p_longitude: p.longitude,
    p_precision: p.precision,
    p_pose_le: p.poseLe,
    p_lieu_dit: lieuDit ?? '',
  })
  if (error) throw error
}

export async function fetchMesPins(): Promise<MesPins> {
  const { data, error } = await supabase.rpc('mes_pins')
  if (error) throw error
  return lireMesPins(data)
}

export async function supprimerPin(id: string): Promise<void> {
  const { error } = await supabase.from('place_drafts').delete().eq('id', id).eq('status', 'open')
  if (error) throw error
}

export async function fetchLieuxProches(pin: string): Promise<LieuProche[]> {
  const { data, error } = await supabase.rpc('lieux_pres_du_pin', { p_pin: pin })
  if (error) throw error
  return lireLieuxProches(data)
}

export async function visiterDepuisPin(pin: string, lieu: string): Promise<{ visite: boolean }> {
  const { data, error } = await supabase.rpc('visiter_depuis_pin', { p_pin: pin, p_lieu: lieu })
  if (error) throw error
  return { visite: booleen(objet(data).visite) }
}
