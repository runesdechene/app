/**
 * QUOI     — les lectures de la carte : tous les lieux vus par l'Explorateur connecté, ou par un
 *            visiteur sans compte (positions floutées, migration 392), et le territoire sous un
 *            point ; et les Explorateurs dont le nom commence par ce qu'on tape.
 * POURQUOI — les deux fonctions lisent `auth.uid()` (migration 363) : l'état de chaque lieu
 *            (inconnu, connu, visité) est celui de la personne qui regarde. S'y ajoute l'option
 *            « Mes lieux en couleur », réglée dans les Préférences.
 */
import { supabase } from '@/shared/supabase/client'
import { booleen, objet } from '@/shared/lib/lire'
import {
  lireExplorateurs,
  lireLieux,
  lireTerritoire,
  type LieuCarte,
  type Territoire,
} from './lireCarte'

export async function fetchCarteLieux(): Promise<LieuCarte[]> {
  const { data, error } = await supabase.rpc('carte_lieux')
  if (error) throw error
  return lireLieux(data)
}

// Sans compte : chaque position est déplacée de quelques kilomètres, tout est « inconnu ».
export async function fetchCartePublique(): Promise<LieuCarte[]> {
  const { data, error } = await supabase.rpc('carte_publique')
  if (error) throw error
  return lireLieux(data)
}

export async function fetchLieuxEnCouleur(): Promise<boolean> {
  const { data, error } = await supabase.rpc('get_my_preferences')
  if (error) throw error
  return booleen(objet(data).lieuxEnCouleur)
}

export async function fetchTerritoire(lat: number, lng: number): Promise<Territoire> {
  const { data, error } = await supabase.rpc('territoire_en', { p_lat: lat, p_lng: lng })
  if (error) throw error
  return lireTerritoire(data)
}

// Les Explorateurs dont le nom commence par `debut` (la même recherche que les mentions).
export async function fetchExplorateurs(debut: string) {
  const { data, error } = await supabase.rpc('chercher_explorateurs', {
    p_debut: debut,
    p_limite: 5,
  })
  if (error) throw error
  return lireExplorateurs(data)
}
