/**
 * QUOI     — les listes des Missives (hub_listes) et les ambassadeurs qu'Uriel choisit (mig 539 et 542).
 */
import { supabase } from '@/shared/supabase/client'

export type Liste = 'tous' | 'prospects' | 'porteurs' | 'meilleurs' | 'ambassadeurs'
export type Role = 'ambassadeur' | 'egerie'

export type LigneDeListe = {
  cle: Liste
  personnes: number
  avecAccord: number
  dernier: { objet: string; le: string } | null
}

export type Ambassadeur = { id: string; nom: string; avatar: string | null; role: Role; fragments: number }
export type CompteTrouve = { id: string; nom: string; email: string | null; avatar: string | null }

export async function lireListes(): Promise<LigneDeListe[]> {
  const { data, error } = await supabase.rpc('hub_listes')
  if (error) throw error
  const lignes = data as { cle: Liste; personnes: number; avec_accord: number; dernier: LigneDeListe['dernier'] }[]
  return lignes.map((l) => ({ cle: l.cle, personnes: l.personnes, avecAccord: l.avec_accord, dernier: l.dernier }))
}

export async function lireAmbassadeurs(): Promise<Ambassadeur[]> {
  const { data, error } = await supabase.rpc('hub_ambassadeurs')
  if (error) throw error
  return data as Ambassadeur[]
}

// Cinq comptes au plus, par nom ou e-mail : la même recherche que l'écran Comptes (hub_comptes).
export async function chercherComptes(recherche: string): Promise<CompteTrouve[]> {
  const { data, error } = await supabase.rpc('hub_comptes', { p_recherche: recherche, p_tri: 'nom', p_limite: 5 })
  if (error) throw error
  return (data as { lignes: CompteTrouve[] }).lignes
}

export async function nommerAmbassadeur(id: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('hub_ambassadeur', { p_user: id, p_role: role })
  if (error) throw error
}

export async function retirerAmbassadeur(id: string): Promise<void> {
  const { error } = await supabase.rpc('hub_retirer_ambassadeur', { p_user: id })
  if (error) throw error
}
