/**
 * QUOI     — les Murmures et Supabase (migration 372) : la liste, une conversation, l'en-tête
 *            d'un correspondant, murmurer, marquer lu, et écouter en direct.
 * POURQUOI — tout passe par les fonctions de la base (auth.uid()) ; l'écoute en direct respecte
 *            la règle d'accès de la table : on n'y reçoit que ses propres murmures.
 */
import { supabase } from '@/shared/supabase/client'
import { lireConversation, lireCorrespondant, lireFils } from './lireMurmures'

export async function fetchFils() {
  const { data, error } = await supabase.rpc('mes_murmures')
  if (error) throw error
  return lireFils(data)
}

export async function fetchConversation(avec: string) {
  const { data, error } = await supabase.rpc('conversation', { p_avec: avec })
  if (error) throw error
  return lireConversation(data)
}

export async function fetchCorrespondant(avec: string) {
  const { data, error } = await supabase.rpc('correspondant', { p_avec: avec })
  if (error) throw error
  return lireCorrespondant(data)
}

export async function murmurer(a: string, texte: string) {
  const { error } = await supabase.rpc('murmurer', { p_a: a, p_texte: texte })
  if (error) throw error
}

export async function lireMurmures(avec: string) {
  const { error } = await supabase.rpc('lire_murmures', { p_avec: avec })
  if (error) throw error
}

// Prévient à chaque murmure écrit ou lu ; rend de quoi arrêter d'écouter.
export function ecouterMurmures(changement: () => void): () => void {
  // Un canal par écoute : supabase rend le canal existant quand le nom est déjà pris, et
  // l'onglet Messages écoute en même temps que l'écran (fermer l'un couperait l'autre).
  const canal = supabase
    .channel(`murmures-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'murmures' }, changement)
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}
