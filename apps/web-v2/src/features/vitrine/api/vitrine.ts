/**
 * QUOI     — ce que la vitrine demande à Supabase, sans compte : les chiffres, les natures,
 *            chercher, l'activité récente, l'aperçu d'un lieu.
 * POURQUOI — des fonctions en lecture, ouvertes aux visiteurs (migration 391) : jamais de
 *            position, jamais de personne ; le reste s'ouvre avec un compte.
 */
import { supabase } from '@/shared/supabase/client'
import { lireActivite, lireApercu, lireChiffres, lireNatures, lireResultats } from './lireVitrine'

export async function fetchChiffres() {
  const { data, error } = await supabase.rpc('get_landing_stats')
  if (error) throw error
  return lireChiffres(data)
}

export async function fetchNatures() {
  const { data, error } = await supabase.rpc('natures_publiques')
  if (error) throw error
  return lireNatures(data)
}

export async function chercher(texte: string, nature: string | null) {
  const { data, error } = await supabase.rpc('recherche_publique', {
    ...(texte.trim() !== '' && { p_texte: texte.trim() }),
    ...(nature !== null && { p_nature: nature }),
    p_limite: nature !== null && texte.trim() === '' ? 20 : 8,
  })
  if (error) throw error
  return lireResultats(data)
}

export async function fetchActivite() {
  const { data, error } = await supabase.rpc('activite_publique', { p_limite: 8 })
  if (error) throw error
  return lireActivite(data)
}

export async function fetchApercu(id: string) {
  const { data, error } = await supabase.rpc('apercu_lieu', { p_id: id })
  if (error) throw error
  return lireApercu(data)
}
