/**
 * QUOI     — tout ce que la fiche d'un lieu demande à Supabase (migrations 364-367).
 * POURQUOI — chaque fonction rend une donnée typée ou lève : jamais un `{ error }` à vérifier
 *            plus loin. Les fonctions de la base lisent `auth.uid()` : on n'envoie jamais qui on est.
 */
import { booleen, chaine, liste, objet } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'
import { lireCompagnons, lireExplorateurs, lireFiche, lireRecompense } from './lireLieu'

export async function fetchFiche(id: string) {
  const { data, error } = await supabase.rpc('fiche_lieu', { p_id: id })
  if (error) throw error
  return lireFiche(data)
}

export async function fetchExplorateurs(id: string) {
  const { data, error } = await supabase.rpc('explorateurs_du_lieu', { p_id: id })
  if (error) throw error
  return lireExplorateurs(data)
}

export async function basculerEnvie(id: string) {
  const { data, error } = await supabase.rpc('basculer_envie', { p_id: id })
  if (error) throw error
  return booleen(data)
}

export async function decouvrirLieu(id: string) {
  const { data, error } = await supabase.rpc('decouvrir_lieu', { p_id: id })
  if (error) throw error
  return lireRecompense(data)
}

export async function visiterLieu(id: string, lat: number, lng: number) {
  const { data, error } = await supabase.rpc('visiter_lieu', { p_id: id, p_lat: lat, p_lng: lng })
  if (error) throw error
  return chaine(objet(data).visiteLe)
}

export async function signalerPresence(lat: number, lng: number) {
  const { error } = await supabase.rpc('signaler_presence', { p_lat: lat, p_lng: lng })
  if (error) throw error
}

export async function fetchCompagnons(id: string) {
  const { data, error } = await supabase.rpc('compagnons_possibles', { p_id: id })
  if (error) throw error
  return lireCompagnons(data)
}

export async function fetchNomsExpedition() {
  const { data, error } = await supabase.rpc('mes_noms_d_expedition')
  if (error) throw error
  return liste(chaine)(data)
}

export async function revendiquerLieu(id: string, compagnons: string[], nom: string | null) {
  const { data, error } = await supabase.rpc('revendiquer_lieu', {
    p_id: id,
    p_compagnons: compagnons,
    p_nom: nom ?? '',
  })
  if (error) throw error
  return chaine(objet(data).nom)
}
