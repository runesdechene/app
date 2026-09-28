/**
 * QUOI     — tout ce que l'onboarding demande à Supabase : les chiffres de l'accueil, le code
 *            par e-mail (envoi et vérification), puis, une fois connecté, les Fragments achetés,
 *            la Charte, le nom, « mon entrée ».
 * POURQUOI — pas de mot de passe : Supabase envoie un code à 6 chiffres, comme la V1. Un e-mail
 *            inconnu crée le compte (le déclencheur handle_new_user fait le reste).
 * ATTENTION — les Fragments se réclament avec l'e-mail vérifié par la connexion (migration 369) :
 *            l'e-mail passé ici n'est plus qu'une formalité de signature.
 */
import { supabase } from '@/shared/supabase/client'
import { lireChiffres, lireEntree } from './lireEntree'

export async function fetchChiffres() {
  const { data, error } = await supabase.rpc('get_landing_stats')
  if (error) throw error
  return lireChiffres(data)
}

export async function envoyerCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

export async function verifierCode(email: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
  if (!data.user) throw new Error('connexion incomplète')
  return data.user.id
}

// Les Fragments achetés avec cet e-mail rejoignent le compte ; rend leur nombre.
export async function reclamerFragments(moi: string, email: string) {
  const { data, error } = await supabase.rpc('unlock_pending_fragments', {
    p_user_id: moi,
    p_email: email,
  })
  if (error) throw error
  return data
}

export async function signerCharte() {
  const { error } = await supabase.rpc('signer_charte')
  if (error) throw error
}

export async function nommer(nom: string) {
  const { error } = await supabase.rpc('nommer_explorateur', { p_nom: nom })
  if (error) throw error
}

export async function fetchEntree() {
  const { data, error } = await supabase.rpc('mon_entree')
  if (error) throw error
  return lireEntree(data)
}
