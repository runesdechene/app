/**
 * QUOI     — la jauge d'énergie de l'Explorateur connecté (migration 399).
 * POURQUOI — la base recharge la jauge en la lisant : on ne calcule rien ici.
 */
import { supabase } from '@/shared/supabase/client'
import { lireEnergie } from './lireEnergie'

export async function fetchEnergie() {
  const { data, error } = await supabase.rpc('mon_energie')
  if (error) throw error
  return lireEnergie(data)
}
