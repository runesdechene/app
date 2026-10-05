/**
 * QUOI     — le Registre et Supabase (migration 371) : lire, écrire, et écouter les nouveaux
 *            messages en direct.
 * POURQUOI — lire et écrire passent par des fonctions de la base (le nom posé par elle) ;
 *            l'écoute est celle du temps réel de Supabase, qui respecte les règles d'accès de la
 *            table : on n'y voit que les canaux qu'on a le droit de lire.
 */
import { nombre, objet } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'
import { lirePassages, lirePersonnes, lireRegistre, type Canal } from './lireRegistre'

// Les 200 derniers messages (le plus que la base rende) : une mention reste retrouvable un moment
// (Uriel, 30/09 : « il faudra un historique plus grand »).
export async function fetchRegistre(canaux: readonly Canal[]) {
  const { data, error } = await supabase.rpc('registre', {
    p_canaux: [...canaux],
    p_limite: 200,
  })
  if (error) throw error
  return lireRegistre(data)
}

// Les gens qui passent (migration 408) : les arrivées, et la dernière connexion de chacun.
export async function fetchPassages() {
  const { data, error } = await supabase.rpc('passages_au_registre')
  if (error) throw error
  return lirePassages(data)
}

// `mentions` : les identifiants des Explorateurs mentionnés (@Nom) — la base vérifie chacun.
export async function ecrire(canal: Canal, texte: string, mentions: string[]) {
  const { error } = await supabase.rpc('ecrire_au_registre', {
    p_canal: canal,
    p_texte: texte,
    p_mentions: mentions,
  })
  if (error) throw error
}

// Aimer un message, ou ne plus l'aimer : un cœur par personne (migration 410). La base refuse
// son propre message.
export async function aimerMessage(id: number, aime: boolean) {
  const { error } = await supabase.rpc('aimer_message', { p_message: id, p_aime: aime })
  if (error) throw error
}

// Les Explorateurs dont le nom commence par ce qu'on tape après « @ ».
export async function chercherExplorateurs(debut: string) {
  // Jusqu'à 12 : « le » en touche des dizaines (migration 407).
  const { data, error } = await supabase.rpc('chercher_explorateurs', {
    p_debut: debut,
    p_limite: 12,
  })
  if (error) throw error
  return lirePersonnes(data)
}

// Prévient à chaque nouveau message ; rend de quoi arrêter d'écouter.
// Un canal par écoute (comme les Murmures) : le Registre ouvert et le point de l'onglet écoutent
// en même temps, et Supabase refuse d'abonner deux fois le même nom.
export function ecouterRegistre(nouveau: () => void): () => void {
  const canal = supabase
    .channel(`registre-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, nouveau)
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}

// Depuis mon dernier passage au Registre (migration 394) : les messages des autres, et ceux qui
// me mentionnent.
export async function fetchRegistreNonLus() {
  const { data, error } = await supabase.rpc('registre_non_lus')
  if (error) throw error
  const n = objet(data)
  return { messages: nombre(n.messages), mentions: nombre(n.mentions) }
}

// J'ai lu le Registre jusqu'au dernier message.
export async function marquerRegistreLu() {
  const { error } = await supabase.rpc('marquer_registre_lu')
  if (error) throw error
}
