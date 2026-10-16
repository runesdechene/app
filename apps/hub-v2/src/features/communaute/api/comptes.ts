/**
 * QUOI     — lit les comptes (hub_comptes, mig 514), la fiche d'un compte (hub_compte) et change son rôle.
 */
import { supabase } from '@/shared/supabase/client'

export type Filtre = 'tous' | 'nouveaux' | 'reactives' | 'sommeil' | 'jamais' | 'porteurs' | 'equipe'
export type Tri = 'visite' | 'inscription' | 'nom'
export type Compte = {
  id: string; nom: string; email: string | null; avatar: string | null; role: string
  provenance: string | null; inscrit: string; derniere_visite: string | null; entree_v2: string | null
  client: boolean; departement: string | null; code: string | null; fragments: number
}
export type ListeDeComptes = {
  total: number
  compteurs: { comptes: number; connectes: number; actifs: number; reactives: number; sommeil: number; jamais: number }
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

export type FicheDeCompte = Omit<Compte, 'fragments'> & {
  compteurs: { decouverts: number; visites: number; ajoutes: number; enigmes: number }
  fragments: { id: number; nom: string | null; image: string | null; source: string; quand: string | null }[]
  achats: { commande: string | null; quand: string | null; statut: string; tag: string | null }[]
  traces: { type: 'visite' | 'decouverte' | 'ajout' | 'enigme' | 'enigme_manquee'; quand: string; texte: string }[]
}

export async function lireCompte(id: string): Promise<FicheDeCompte | null> {
  const { data, error } = await supabase.rpc('hub_compte', { p_id: id })
  if (error) throw error
  return data as FicheDeCompte | null
}

export async function changerRole(id: string, role: string): Promise<void> {
  const { error } = await supabase.rpc('changer_role', { p_user: id, p_role: role })
  if (error) throw error
}
