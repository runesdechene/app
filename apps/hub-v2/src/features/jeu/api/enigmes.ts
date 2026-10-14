/**
 * QUOI     — lit les énigmes (hub_enigmes, hub_enigme), les enregistre (mig 519), et lit les cultures.
 * POURQUOI — une énigme ne se supprime pas (les réponses des joueurs la référencent) : elle se désactive.
 */
import { supabase } from '@/shared/supabase/client'
import { versEnvoi, type Brouillon, type Difficulte } from '../lib/enigme'

export type Actives = 'toutes' | 'actives' | 'inactives'
export type Criteres = {
  culture: string | null; difficulte: Difficulte | null; actives: Actives; recherche: string; limite: number; decalage: number
}
export type LigneEnigme = {
  id: number; question: string; culture: string | null; difficulte: Difficulte; format: 'qcm' | 'free'
  active: boolean; reponse: string; cree_le: string
}
export type ListeEnigmes = {
  total: number
  compteurs: { toutes: number; actives: number; parCulture: Record<string, number> }
  lignes: LigneEnigme[]
}
export type FicheEnigme = Omit<Brouillon, 'choix' | 'variantes'> & {
  id: number; choix: string[] | null; variantes: string[]; cree_le: string
  reponses: number; percees: number; signalements: number
}
export type Culture = { id: string; label: string; active: boolean }

export async function lireEnigmes(c: Criteres): Promise<ListeEnigmes> {
  const { data, error } = await supabase.rpc('hub_enigmes', {
    p_actives: c.actives, p_recherche: c.recherche, p_limite: c.limite, p_decalage: c.decalage,
    ...(c.culture && { p_culture: c.culture }), ...(c.difficulte && { p_difficulte: c.difficulte }),
  })
  if (error) throw new Error(error.message)
  return data as ListeEnigmes
}

export async function lireEnigme(id: number): Promise<FicheEnigme | null> {
  const { data, error } = await supabase.rpc('hub_enigme', { p_id: id })
  if (error) throw new Error(error.message)
  return data as FicheEnigme | null
}

// Rend l'id de l'énigme ; le message de la base (ses refus) passe tel quel.
export async function enregistrerEnigme(id: number | null, brouillon: Brouillon): Promise<number> {
  const { data, error } = await supabase.rpc('hub_enregistrer_enigme', { ...versEnvoi(brouillon), ...(id !== null && { p_id: id }) })
  if (error) throw new Error(error.message)
  return data
}

// Lecture publique des cultures (enigma_themes), dans l'ordre du jeu.
export async function lireCultures(): Promise<Culture[]> {
  const { data, error } = await supabase.from('enigma_themes').select('id, label, active').order('sort_order')
  if (error) throw new Error(error.message)
  return data
}
