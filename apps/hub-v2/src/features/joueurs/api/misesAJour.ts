/**
 * QUOI     — lit les mises à jour publiées (mises_a_jour_publiees), en publie, en modifie, en supprime, envoie leur image.
 * POURQUOI — les quatre RPC sont gardées par _is_admin(). Publier prévient aussi les joueurs abonnés (push) ;
 *            modifier garde la date de publication. Le fichier choisi ne part qu'à l'enregistrement ; un ancien fichier
 *            (remplacé, retiré, ou d'une note supprimée) quitte le bucket une fois la base à jour : si le retrait
 *            échoue, l'erreur le dit comme un succès partiel.
 */
import { envoyerFichier, retirerFichier } from '@/shared/lib/envoi'
import { messageDErreur } from '@/shared/lib/erreur'
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

// Une image ou une version vide ne part pas : la base les range à null (omettre p_image retire l'image).
function champs(m: MiseAJourAEcrire) {
  const args: { p_titre: string; p_texte: string; p_image?: string; p_version?: string } = {
    p_titre: m.titre.trim(), p_texte: m.texte.trim(),
  }
  if (m.image) args.p_image = m.image
  const version = m.version?.trim()
  if (version) args.p_version = version
  return args
}

async function publierMiseAJour(m: MiseAJourAEcrire): Promise<number> {
  const { data, error } = await supabase.rpc('publier_mise_a_jour', champs(m))
  if (error) throw new Error(error.message)
  return (data as { id: number }).id
}

async function modifierMiseAJour(id: number, m: MiseAJourAEcrire): Promise<void> {
  const { error } = await supabase.rpc('modifier_mise_a_jour', { p_id: id, ...champs(m) })
  if (error) throw new Error(error.message)
}

export type Brouillon = { titre: string; texte: string; version: string; fichier: File | null; retirer: boolean }

/**
 * Publie (fiche null) ou modifie une note. Ordre : envoi du nouveau fichier, RPC, retrait de l'ancien fichier.
 * La RPC qui échoue défait l'envoi ; le retrait qui échoue est dit comme un succès partiel.
 */
export async function enregistrerMiseAJour(fiche: MiseAJour | null, b: Brouillon): Promise<void> {
  const envoyee = b.fichier ? await envoyerImage(b.fichier) : null
  const image = envoyee ?? (b.retirer ? null : fiche?.image ?? null)
  const note = { titre: b.titre, texte: b.texte, version: b.version, image }
  try {
    if (fiche) await modifierMiseAJour(fiche.id, note)
    else await publierMiseAJour(note)
  } catch (e) {
    if (envoyee) await retirerFichier(BUCKET, envoyee).catch(() => undefined)
    throw e
  }
  if (fiche?.image && fiche.image !== image) {
    try {
      await retirerFichier(BUCKET, fiche.image)
    } catch (e) {
      throw new Error(`Enregistré, mais l’ancienne image n’a pas pu être retirée : ${messageDErreur(e)}`, { cause: e })
    }
  }
}

export async function supprimerMiseAJour(id: number, image: string | null): Promise<void> {
  const { error } = await supabase.rpc('supprimer_mise_a_jour', { p_id: id })
  if (error) throw new Error(error.message)
  if (!image) return
  try {
    await retirerFichier(BUCKET, image)
  } catch (e) {
    throw new Error(`Supprimée, mais l’image n’a pas pu être retirée : ${messageDErreur(e)}`, { cause: e })
  }
}

const envoyerImage = (fichier: File) => envoyerFichier(BUCKET, cheminDeImage(fichier), fichier)
