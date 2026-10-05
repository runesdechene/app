/**
 * QUOI     — mes Compagnies vues comme canaux (migration 422) : l'id, le nom, la couleur.
 * POURQUOI — La Communauté en fait des gélules, la fenêtre « Revendiquer » une liste « Pour une
 *            Compagnie » : deux zones, une seule lecture, ici.
 */
import { chaine, liste, objet } from '@/shared/lib/lire'
import { supabase } from './client'

export type CanalCompagnie = { id: string; nom: string; couleur: string }

export const lireCanaux = liste((v): CanalCompagnie => {
  const o = objet(v)
  return { id: chaine(o.id), nom: chaine(o.nom), couleur: chaine(o.couleur) }
})

export async function fetchCanaux() {
  const { data, error } = await supabase.rpc('mes_canaux')
  if (error) throw error
  return lireCanaux(data)
}
