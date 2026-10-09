/**
 * QUOI     — les écritures du profil : nom, présentation, Instagram, titres portés, accord des
 *            titres, signe ; et la liste des titres qu'on peut porter.
 * POURQUOI — `update_my_profile` et `set_title_gender` sont des fonctions V1 qui répondent
 *            `{ error }` au lieu d'échouer : `verifier` transforme cette réponse en erreur, pour
 *            que l'écran n'ait qu'un seul cas à traiter.
 * ATTENTION — `update_my_profile` écrit `first_name` ; le profil lit
 *            `COALESCE(display_name, first_name)` (règle de produit.md).
 */
import { supabase } from '@/shared/supabase/client'
import { chaine, liste, nombre, objet } from '@/shared/lib/lire'
import type { Titre } from './lireProfil'
import { monIdentifiant } from './session'

async function moi(): Promise<string> {
  const id = await monIdentifiant()
  if (!id) throw new Error('Connexion requise')
  return id
}

function verifier(reponse: unknown) {
  if (objet(reponse).error !== undefined) throw new Error('Écriture refusée par la base')
}

export async function enregistrerProfil(p: { nom: string; bio: string; instagram: string }) {
  const { data, error } = await supabase.rpc('update_my_profile', {
    p_user_id: await moi(),
    p_first_name: p.nom,
    p_bio: p.bio,
    p_instagram: p.instagram,
  })
  if (error) throw error
  verifier(data)
}

export async function titresDebloques(): Promise<Titre[]> {
  const { data, error } = await supabase.rpc('get_user_titles', { p_user_id: await moi() })
  if (error) throw error
  return liste((v) => {
    const t = objet(v)
    return { id: nombre(t.id), nom: chaine(t.name) }
  })(objet(data).unlockedGeneralTitles)
}

export async function choisirTitres(ids: number[]) {
  const { error } = await supabase.rpc('set_my_displayed_titles', { p_title_ids: ids })
  if (error) throw error
}

export async function choisirAccord(genre: 'm' | 'f') {
  const { data, error } = await supabase.rpc('set_title_gender', { p_gender: genre })
  if (error) throw error
  verifier(data)
}

// Se placer sous le signe d'un de ses Fragments (migration 356 : refusé si on ne l'a pas).
export async function choisirSigne(fragmentId: number) {
  const { error } = await supabase.rpc('set_my_signe', { p_fragment_id: fragmentId })
  if (error) throw error
}
