/**
 * QUOI     — les suites des Missives (Bienvenue, Bienvenue du stand, Après le premier achat) : les lire, les
 *            activer, ajouter, régler ou retirer leurs e-mails (mig 551).
 * POURQUOI — un e-mail de suite est une Missive comme une autre : il s'écrit dans Écrire, sous son id.
 */
import { supabase } from '@/shared/supabase/client'
import { brouillonVide } from '../lib/brouillon'

export type CleSuite = 'bienvenue' | 'stand' | 'apres_achat'

export type Etape = {
  id: number
  jour: number
  missiveId: number
  objet: string
  envoyes: number
  ouverts: number
  clics: number
}

export type Suite = {
  cle: CleSuite
  nom: string
  active: boolean
  exigeAccord: boolean
  enCours: number
  finis: number
  arretes: number
  etapes: Etape[]
}

type SuiteLue = {
  cle: CleSuite; nom: string; active: boolean; exige_accord: boolean; en_cours: number; finis: number; arretes: number
  etapes: { id: number; jour: number; missive_id: number; objet: string; envoyes: number; ouverts: number; clics: number }[]
}

export async function lireSuites(): Promise<Suite[]> {
  const { data, error } = await supabase.rpc('hub_suites')
  if (error) throw error
  return (data as SuiteLue[]).map((s) => ({
    cle: s.cle, nom: s.nom, active: s.active, exigeAccord: s.exige_accord,
    enCours: s.en_cours, finis: s.finis, arretes: s.arretes,
    etapes: s.etapes.map((e) => ({ ...e, missiveId: e.missive_id })),
  }))
}

export async function activerSuite(cle: CleSuite, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('hub_activer_suite', { p_cle: cle, p_active: active })
  if (error) throw error
}

/** Rend l'id de la Missive neuve, à ouvrir dans Écrire. */
export async function ajouterEtape(cle: CleSuite, jour: number): Promise<number> {
  const b = brouillonVide('missive')
  const { data, error } = await supabase.rpc('hub_ajouter_etape', {
    p_cle: cle,
    p_jour: jour,
    p: { modele: b.lettre.modele, contenu: b.lettre.contenu, couleurs: b.couleurs, objet: '', apercu: '' },
  })
  if (error) throw error
  return data
}

export async function reglerEtape(id: number, jour: number): Promise<void> {
  const { error } = await supabase.rpc('hub_regler_etape', { p_id: id, p_jour: jour })
  if (error) throw error
}

export async function retirerEtape(id: number): Promise<void> {
  const { error } = await supabase.rpc('hub_retirer_etape', { p_id: id })
  if (error) throw error
}
