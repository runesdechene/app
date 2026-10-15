/**
 * QUOI     — lit les mises à jour publiées (mises_a_jour_publiees), en publie, en modifie, en supprime, envoie leur image.
 * POURQUOI — les quatre RPC sont gardées par _is_admin(). Publier prévient aussi les joueurs abonnés (push) ;
 *            modifier garde la date de publication. Une image remplacée ou une note supprimée perd son ancien fichier
 *            du bucket une fois la base à jour : si le retrait échoue, l'erreur remonte (le fichier orphelin se voit).
 */
import { envoyerFichier, retirerFichier } from '@/shared/lib/envoi'
import { supabase } from '@/shared/supabase/client'
import { BUCKET, cheminDeImage } from '../lib/miseAJour'

export type MiseAJour = {
  id: number; titre: string; texte: string; quand: string; image: string | null; version: string | null
  coeurs: number; mots: number
}
export type MiseAJourAEcrire = { titre: string; texte: string; image: string | null; version: string | null }

export async function lireMisesAJour(): Promise<MiseAJour[]> {
  const { data, error } = await supabase.rpc('mises_a_jour_publiees')
  if (error) throw new Error(error.message)
  return data as MiseAJour[]
}

// Une image ou une version vide ne part pas : la base les range à null.
const champs = (m: MiseAJourAEcrire) => ({
  p_titre: m.titre.trim(), p_texte: m.texte.trim(),
  ...(m.image && { p_image: m.image }), ...(m.version?.trim() && { p_version: m.version.trim() }),
})

export async function publierMiseAJour(m: MiseAJourAEcrire): Promise<number> {
  const { data, error } = await supabase.rpc('publier_mise_a_jour', champs(m))
  if (error) throw new Error(error.message)
  return (data as { id: number }).id
}

// `ancienneImage` : l'adresse que la note avait avant ; retirée du bucket si l'image a changé.
export async function modifierMiseAJour(id: number, m: MiseAJourAEcrire, ancienneImage: string | null): Promise<void> {
  const { error } = await supabase.rpc('modifier_mise_a_jour', { p_id: id, ...champs(m) })
  if (error) throw new Error(error.message)
  if (ancienneImage && ancienneImage !== m.image) await retirerFichier(BUCKET, ancienneImage)
}

export async function supprimerMiseAJour(id: number, image: string | null): Promise<void> {
  const { error } = await supabase.rpc('supprimer_mise_a_jour', { p_id: id })
  if (error) throw new Error(error.message)
  if (image) await retirerFichier(BUCKET, image)
}

export const envoyerImage = (fichier: File) => envoyerFichier(BUCKET, cheminDeImage(fichier), fichier)
