/**
 * QUOI     — lit la liste des comptes (hub_comptes, mig 514).
 */
import { supabase } from '@/shared/supabase/client'

export type Filtre = 'tous' | 'nouveaux' | 'reactives' | 'sommeil' | 'porteurs' | 'equipe'
export type Tri = 'visite' | 'inscription' | 'nom'
export type Compte = {
  id: string; nom: string; email: string | null; avatar: string | null; role: string
  provenance: string | null; inscrit: string; derniere_visite: string | null; entree_v2: string | null
  client: boolean; departement: string | null; code: string | null; fragments: number
}
export type ListeDeComptes = {
  total: number
  compteurs: { comptes: number; actifs: number; reactives: number; sommeil: number }
  provenances: string[]
  departements: string[]
  lignes: Compte[]
}
export type Criteres = {
  filtre: Filtre; recherche: string; provenance: string | null; departement: string | null
  tri: Tri; limite: number; decalage: number
}

export async function lireComptes(c: Criteres): Promise<ListeDeComptes> {
  const { data, error } = await supabase.rpc('hub_comptes', {
    p_filtre: c.filtre, p_recherche: c.recherche, p_tri: c.tri, p_limite: c.limite, p_decalage: c.decalage,
    ...(c.provenance && { p_provenance: c.provenance }), ...(c.departement && { p_departement: c.departement }),
  })
  if (error) throw error
  return data as ListeDeComptes
}
