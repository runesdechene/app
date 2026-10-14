/**
 * QUOI      — les Compagnies vues par l'équipe (hub_compagnies, hub_compagnie, hub_modifier_compagnie, mig 516).
 * ATTENTION — l'erreur de la base porte le message à montrer (« Ce nom est déjà pris »…) : on le garde.
 */
import { supabase } from '@/shared/supabase/client'

export type Compagnie = {
  id: string; nom: string; couleur: string; devise: string | null; privee: boolean; retiree: boolean
  membres: number; chef: string | null; fondee: string | null
}
export type Membre = { id: string; nom: string; avatar: string | null; role: 'chef' | 'officier' | 'membre'; depuis: string | null }
export type FicheDeCompagnie = Omit<Compagnie, 'membres' | 'chef'> & { mission: string | null; avatar: string | null; membres: Membre[] }
export type Identite = { nom: string; devise: string; mission: string; couleur: string }

export async function lireCompagnies(): Promise<Compagnie[]> {
  const { data, error } = await supabase.rpc('hub_compagnies')
  if (error) throw error
  return data as Compagnie[]
}

export async function lireCompagnie(id: string): Promise<FicheDeCompagnie | null> {
  const { data, error } = await supabase.rpc('hub_compagnie', { p_id: id })
  if (error) throw error
  return data as FicheDeCompagnie | null
}

export async function modifierCompagnie(id: string, i: Identite): Promise<void> {
  const { error } = await supabase.rpc('hub_modifier_compagnie', {
    p_id: id, p_nom: i.nom, p_devise: i.devise, p_mission: i.mission, p_couleur: i.couleur,
  })
  if (error) throw new Error(error.message)
}
