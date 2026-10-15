/**
 * QUOI     — lit les contributions (hub_contributions, mig 521), les étiquettes de photo, et écrit : décider
 *            (valider, archiver), corriger le message, poser et retirer une étiquette, régler les canaux et le
 *            produit de chaque photo, supprimer une photo ou une contribution.
 * POURQUOI — la base décide (garde de l'équipe, couronnes versées une seule fois) : son message remonte tel quel.
 *            Supprimer va de l'extérieur vers l'intérieur : Shopify, puis le bucket, puis la base. Chaque étape
 *            s'arrête à sa première erreur ; en cas d'échec le bout déjà fait se refait sans dommage
 *            (Shopify « Not Found » toléré, un fichier absent n'est pas une erreur), donc réessayer suffit.
 *            Une suppression de plusieurs photos interrompue laisse le `media` des premières périmé jusqu'au
 *            nouvel essai : la tolérance du « Not Found » l'absorbe.
 */
import { cheminDepuisAdresse, retirerFichiers } from '@/shared/lib/envoi'
import { supabase } from '@/shared/supabase/client'
import { texteAlternatif } from '../lib/contribution'
import { pousserImage, retirerImage, type ProduitShopify } from './shopify'

const BUCKET = 'community-photos'

export type StatutContribution = 'pending' | 'approved' | 'archived'
export type Filtre = StatutContribution | 'toutes'

export type PhotoDeContribution = {
  id: string; url: string; chemin: string | null; taille: string | null
  produit_id: string | null; produit_handle: string | null; produit_titre: string | null
  media: string | null; communaute: boolean; mur: boolean
}
export type Etiquette = { id: string; nom: string }
export type Contribution = {
  id: string; quand: string | null; statut: StatutContribution; nom: string; email: string | null
  instagram: string | null; role: string | null; compte: string | null; lieu: string | null
  code_postal: string | null; departement: string | null; message: string | null; note_equipe: string | null
  taille: string | null; produit: string | null; hauteur: number | null; epaules: number | null
  note_experience: number | null; note_produits: number | null; diffusion: boolean
  recompensee_le: string | null; images: PhotoDeContribution[]; etiquettes: Etiquette[]
}
export type ListeContributions = {
  total: number
  compteurs: { a_valider: number; publiees: number; archivees: number; au_mur: number; plus_ancienne: string | null }
  lignes: Contribution[]
}
export type Criteres = { filtre: Filtre; recherche: string; limite: number; decalage: number }

export async function lireContributions(c: Criteres): Promise<ListeContributions> {
  const { data, error } = await supabase.rpc('hub_contributions', {
    p_statut: c.filtre, p_recherche: c.recherche, p_limite: c.limite, p_decalage: c.decalage,
  })
  if (error) throw new Error(error.message)
  return data as ListeContributions
}

export async function lireEtiquettes(): Promise<Etiquette[]> {
  const { data, error } = await supabase.rpc('get_photo_tags')
  if (error) throw new Error(error.message)
  return data.map((t) => ({ id: t.id, nom: t.name }))
}

export async function modererContribution(id: string, statut: StatutContribution, couronnes?: number): Promise<void> {
  const { error } = await supabase.rpc('moderate_submission', {
    p_submission_id: id, p_status: statut, ...(couronnes !== undefined && { p_crowns: couronnes }),
  })
  if (error) throw new Error(error.message)
}

/** Les types générés n'acceptent pas null : un message vidé s'écrit une chaîne vide. */
export async function modifierMessage(id: string, message: string | null): Promise<void> {
  const { error } = await supabase.rpc('update_submission_message', { p_submission_id: id, p_message: message ?? '' })
  if (error) throw new Error(error.message)
}

export async function ajouterEtiquette(id: string, etiquette: string): Promise<void> {
  const { error } = await supabase.rpc('add_tag_to_submission', { p_submission_id: id, p_tag_id: etiquette })
  if (error) throw new Error(error.message)
}

export async function retirerEtiquette(id: string, etiquette: string): Promise<void> {
  const { error } = await supabase.rpc('remove_tag_from_submission', { p_submission_id: id, p_tag_id: etiquette })
  if (error) throw new Error(error.message)
}

export async function creerEtiquette(nom: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_photo_tag', { p_name: nom })
  if (error) throw new Error(error.message)
  return data
}

async function ecrire(requete: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await requete
  if (error) throw new Error(error.message)
}

export const montrerAuMur = (photoId: string, oui: boolean) =>
  ecrire(supabase.rpc('set_submission_image_wall', { p_image_id: photoId, p_show: oui }))

export const montrerDansCommunaute = (photoId: string, oui: boolean) =>
  ecrire(supabase.rpc('set_submission_image_community', { p_image_id: photoId, p_show: oui }))

export const relierProduit = (photoId: string, p: ProduitShopify) =>
  ecrire(supabase.rpc('set_submission_image_shopify_product', {
    p_image_id: photoId, p_product_id: p.id, p_handle: p.handle, p_title: p.titre,
  }))

/** Retire d'abord l'image de la fiche Shopify (la base la remet aussi hors de la communauté). */
export async function delierProduit(photo: PhotoDeContribution): Promise<void> {
  if (photo.produit_id && photo.media) await retirerImage(photo.produit_id, photo.media)
  await ecrire(supabase.rpc('clear_submission_image_shopify_product', { p_image_id: photo.id }))
}

/** Oui : la photo entre dans la galerie du produit ; non : elle en sort. Le média garde l'identifiant Shopify. */
export async function mettreSurLaFiche(c: Contribution, photo: PhotoDeContribution, oui: boolean): Promise<void> {
  if (!photo.produit_id) throw new Error('Relie d’abord un produit')
  if (oui) {
    const media = await pousserImage(photo.produit_id, photo.url, texteAlternatif(c.nom, c.hauteur, photo.taille))
    try {
      await ecrire(supabase.rpc('set_submission_image_media', { p_image_id: photo.id, p_media_id: media }))
    } catch (e) {
      // La base n'a pas noté le média : l'image poussée serait orpheline. Retrait de secours, l'erreur d'origine remonte.
      await retirerImage(photo.produit_id, media).catch(() => undefined)
      throw e
    }
    return
  }
  if (photo.media) await retirerImage(photo.produit_id, photo.media)
  await ecrire(supabase.rpc('set_submission_image_media', { p_image_id: photo.id, p_media_id: '' }))
}

/** Shopify d'abord (s'il refuse, rien n'est supprimé), puis le bucket, puis la base. */
async function nettoyer(photos: PhotoDeContribution[]): Promise<void> {
  for (const photo of photos) {
    if (photo.produit_id && photo.media) await retirerImage(photo.produit_id, photo.media)
  }
  const chemins = photos.flatMap((p) => {
    // Là où le fichier est vraiment : son adresse d'abord, le chemin enregistré à défaut.
    const chemin = cheminDepuisAdresse(BUCKET, p.url) ?? p.chemin
    return chemin ? [chemin] : []
  })
  await retirerFichiers(BUCKET, chemins)
}

export async function supprimerPhoto(photo: PhotoDeContribution): Promise<void> {
  await nettoyer([photo])
  await ecrire(supabase.rpc('delete_submission_image', { p_image_id: photo.id }))
}

export async function supprimerContribution(c: Contribution): Promise<void> {
  await nettoyer(c.images)
  await ecrire(supabase.rpc('delete_photo_submission', { p_submission_id: c.id }))
}
