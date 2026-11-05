/**
 * QUOI     — les appels du scan : les empreintes de référence (pour tous), les vues ajoutées ou
 *            retirées (admins), le scan noté (pour tous), la liste des Fragments visibles ; pour un
 *            membre, ce qu'un rescan peut offrir (lu dans `mon_fragment`, migration 584).
 * POURQUOI — migration 474. Les vecteurs partent arrondis : c'est le poids de l'appel de chaque
 *            joueur qui ouvre le scanner.
 * ATTENTION — une requête supabase-js est paresseuse (règle v2.md) : `noterScan` l'attend, et
 *            l'écran du scan relit le Codex une fois le scan noté.
 */
import { supabase } from '@/shared/supabase/client'
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
import { arrondir } from '../lib/regleDuBip'
import { MODELE } from '../lib/modele'
import { lireEmpreintes } from './lireEmpreintes'

export type FragmentVisible = { id: number; nom: string; illustration: string | null }

export async function fetchEmpreintes() {
  const { data, error } = await supabase.rpc('empreintes_du_scan', { p_modele: MODELE })
  if (error) throw error
  return lireEmpreintes(data)
}

export async function fetchFragmentsVisibles(): Promise<FragmentVisible[]> {
  const { data, error } = await supabase
    .from('title_fragments')
    .select('id, name, illustration_url')
    .eq('visible', true)
    .order('name')
  if (error) throw error
  return liste((v: unknown) => {
    const o = objet(v)
    return {
      id: nombre(o.id),
      nom: chaine(o.name),
      illustration: ouNull(chaine)(o.illustration_url),
    }
  })(data)
}

export async function ajouterVue(fragment: number, vecteur: ArrayLike<number>): Promise<number> {
  const { data, error } = await supabase.rpc('ajouter_vue', {
    p_fragment: fragment,
    p_vecteur: arrondir(vecteur),
    p_modele: MODELE,
  })
  if (error) throw error
  return nombre(data)
}

// Ce que le scanner permet d'apprendre : rien, ajouter des vues (Porteur), ou aussi les retirer (admin).
export type Apprendre = 'non' | 'porteur' | 'admin'

// Tout Porteur, ou un admin (mig 585).
export async function peutApprendreVue(): Promise<boolean> {
  const { data, error } = await supabase.rpc('peut_apprendre_vue')
  if (error) throw error
  return data === true
}

export async function retirerEmpreinte(id: number): Promise<void> {
  const { error } = await supabase.rpc('retirer_empreinte', { p_id: id })
  if (error) throw error
}

export async function noterScan(fragment: number): Promise<void> {
  await supabase.rpc('noter_scan', { p_fragment: fragment })
}

// Un motif déjà scanné avant ce scan-ci : le scanner propose ses choix sur la caméra.
export type Rescan = { porte: boolean; restantes: number; gratuiteDuJour: boolean }

export async function fetchRescan(fragment: number): Promise<Rescan | null> {
  const { data, error } = await supabase.rpc('mon_fragment', { p_id: fragment })
  if (error) throw error
  if (data === null) return null
  const o = objet(data)
  if (nombre(o.scans) <= 1) return null // le premier scan : la découverte du Fragment
  return {
    porte: o.etat === 'porte',
    restantes: nombre(o.restantes),
    gratuiteDuJour: booleen(o.gratuiteDuJour ?? true),
  }
}
