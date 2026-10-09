/**
 * QUOI     — les appels du scan : les empreintes de référence (pour tous), les vues ajoutées ou
 *            retirées (admins), le scan noté (pour tous), la liste des Fragments visibles.
 * POURQUOI — migration 474. Les vecteurs partent arrondis : c'est le poids de l'appel de chaque
 *            joueur qui ouvre le scanner.
 * ATTENTION — `noterScan` ne s'attend pas : une requête supabase-js est paresseuse, d'où le `then`
 *            (règle v2.md).
 */
import { supabase } from '@/shared/supabase/client'
import { chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
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

export async function retirerEmpreinte(id: number): Promise<void> {
  const { error } = await supabase.rpc('retirer_empreinte', { p_id: id })
  if (error) throw error
}

export function noterScan(fragment: number): void {
  void supabase.rpc('noter_scan', { p_fragment: fragment }).then()
}
