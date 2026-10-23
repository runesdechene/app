/**
 * QUOI     — une Missive dans le Hub : la lire, l'enregistrer, la programmer, poser une photo, s'envoyer un essai.
 * POURQUOI — l'équipe lit la table `missives` directement (RLS : admins, mig 539) ; elle écrit par les RPC de la
 *            mig 543, qui refusent de toucher une Missive déjà partie.
 */
import type { Couleurs, Lettre } from '@runes/missives'
import { pencher } from '../lib/pencher'
import { envoyerFichier } from '@/shared/lib/envoi'
import { appelerFonction, lireReponse } from '@/shared/lib/fonctions'
import { supabase } from '@/shared/supabase/client'
import type { Brouillon } from '../lib/brouillon'
import type { Liste } from './listes'

export async function lireMissive(id: number): Promise<Brouillon> {
  const { data, error } = await supabase
    .from('missives')
    .select('id, modele, contenu, couleurs, objet, apercu, liste')
    .eq('id', id)
    .single()
  if (error) throw error
  return {
    id: data.id,
    lettre: { modele: data.modele, contenu: data.contenu } as Lettre,
    couleurs: data.couleurs as Couleurs,
    objet: data.objet,
    apercu: data.apercu ?? '',
    liste: data.liste as Liste | null,
  }
}

/** Rend l'id de la Missive, neuve ou déjà là. `envoi` : la lettre telle qu'elle part (photos penchées). */
export async function enregistrerMissive(b: Brouillon, envoi: Lettre | null = null): Promise<number> {
  const { data, error } = await supabase.rpc('hub_enregistrer_missive', {
    p: {
      id: b.id, modele: b.lettre.modele, contenu: b.lettre.contenu, contenu_envoi: envoi?.contenu ?? null,
      couleurs: b.couleurs, objet: b.objet, apercu: b.apercu, liste: b.liste,
    },
  })
  if (error) throw error
  return data
}

/** `quand` à null : maintenant. */
export async function programmerMissive(id: number, quand: string | null): Promise<void> {
  const { error } = await supabase.rpc('hub_programmer_missive', { p_id: id, p_quand: quand ?? new Date().toISOString() })
  if (error) throw error
}

export async function deposerPhoto(photo: Blob): Promise<string> {
  const nom = `${crypto.randomUUID()}.jpg`
  return envoyerFichier('missives', nom, new File([photo], nom, { type: 'image/jpeg' }))
}

/** Une photo du brouillon, penchée sur la couleur de ses coins, puis déposée : son adresse. */
export async function cuirePhoto(url: string, degres: number, couleur: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Une photo de la lettre n’a pas pu être lue (HTTP ${String(r.status)}).`)
  return deposerPhoto(await pencher(await r.blob(), degres, couleur))
}

export async function envoyerEssai(id: number): Promise<void> {
  await lireReponse(await appelerFonction('missives-essai', { methode: 'POST', corps: { id } }))
}
