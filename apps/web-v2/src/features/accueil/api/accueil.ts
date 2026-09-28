/**
 * QUOI     — tout ce que l'Accueil demande à Supabase (migration 368).
 * POURQUOI — chaque fonction rend une donnée typée ou lève. Les fonctions de la base lisent
 *            `auth.uid()` : on n'envoie jamais qui on est.
 */
import { supabase } from '@/shared/supabase/client'
import { lireAjoutes, lireBanniere, lireChemins, lireSalut } from './lireAccueil'

export async function fetchBanniere() {
  const { data, error } = await supabase.rpc('get_random_home_banner')
  if (error) throw error
  return lireBanniere(data)
}

export async function fetchAjoutes() {
  const { data, error } = await supabase.rpc('accueil_ajoutes', { p_limite: 10 })
  if (error) throw error
  return lireAjoutes(data)
}

export async function fetchChemins() {
  const { data, error } = await supabase.rpc('sur_les_chemins', { p_limite: 20 })
  if (error) throw error
  return lireChemins(data)
}

export async function saluer(evenement: string) {
  const { data, error } = await supabase.rpc('saluer', { p_evenement: evenement })
  if (error) throw error
  return lireSalut(data)
}
