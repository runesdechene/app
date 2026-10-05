/**
 * QUOI     — les Compagnies et Supabase (migrations 421 et 422) : lire la liste et une fiche,
 *            rejoindre (ou demander).
 * POURQUOI — chaque geste passe par une fonction de la base, qui lit `auth.uid()` et refuse ce qui
 *            n'est pas permis (avec un indice : `porteur`, `nom_pris`, `role`…).
 */
import { chaine, objet } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'
import { lireFicheCompagnie, lireListe } from './lireCompagnies'

export async function fetchCompagnies() {
  const { data, error } = await supabase.rpc('compagnies')
  if (error) throw error
  return lireListe(data)
}

export async function fetchCompagnie(id: string) {
  const { data, error } = await supabase.rpc('compagnie', { p_id: id })
  if (error) throw error
  return lireFicheCompagnie(data)
}

// Publique : on en devient membre ; privée : la demande part aux officiers.
export async function rejoindre(id: string, mot?: string): Promise<'membre' | 'demande'> {
  const { data, error } = await supabase.rpc('rejoindre_compagnie', {
    p_id: id,
    ...(mot !== undefined && mot.trim() !== '' && { p_mot: mot }),
  })
  if (error) throw error
  return chaine(objet(data).etat) === 'membre' ? 'membre' : 'demande'
}
