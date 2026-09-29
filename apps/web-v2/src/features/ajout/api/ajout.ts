/**
 * QUOI     — tout ce que le parcours « Ajouter un lieu » demande à Supabase (migration 381) : les
 *            natures, les époques, les lieux voisins, l'envoi des photos, et l'ajout.
 * POURQUOI — les photos partent dans le dossier du compte (place-images/places/<moi>/, le rangement
 *            de la V1) : la base refuse toute autre adresse. Les fonctions lisent `auth.uid()` : on
 *            n'envoie jamais qui on est, sauf ce chemin de dossier, que la base revérifie.
 */
import type { Point } from '@/shared/lib/distance'
import { supabase } from '@/shared/supabase/client'
import type { Brouillon, PhotoBrouillon } from '../lib/brouillon'
import { lireAjout, lireEpoques, lireNatures, lireVoisins } from './lireAjout'

const SEAU = 'place-images'

export async function fetchNatures() {
  const { data, error } = await supabase.rpc('natures_de_lieu')
  if (error) throw error
  return lireNatures(data)
}

export async function fetchEpoques() {
  const { data, error } = await supabase.rpc('epoques')
  if (error) throw error
  return lireEpoques(data)
}

export async function fetchVoisins(ici: Point) {
  const { data, error } = await supabase.rpc('lieux_voisins', {
    p_latitude: ici.latitude,
    p_longitude: ici.longitude,
  })
  if (error) throw error
  return lireVoisins(data)
}

export type ImageEnvoyee = { id: string; url: string; thumb: string }

async function envoyer(chemin: string, blob: Blob) {
  const { error } = await supabase.storage
    .from(SEAU)
    .upload(chemin, blob, { contentType: 'image/webp', upsert: true })
  if (error) throw error
  return supabase.storage.from(SEAU).getPublicUrl(chemin).data.publicUrl
}

export async function envoyerPhotos(photos: PhotoBrouillon[]): Promise<ImageEnvoyee[]> {
  const { data } = await supabase.auth.getSession()
  const moi = data.session?.user.id
  if (!moi) throw new Error('Connexion requise')
  const images: ImageEnvoyee[] = []
  // Une à une : sur un téléphone en montagne, dix envois à la fois échouent ensemble.
  for (const photo of photos) {
    const dossier = `places/${moi}/${photo.id}`
    const url = await envoyer(`${dossier}.webp`, photo.grande)
    const thumb = await envoyer(`${dossier}_thumb.webp`, photo.vignette)
    images.push({ id: photo.id, url, thumb })
  }
  return images
}

export async function ajouterLieu(b: Brouillon, images: ImageEnvoyee[], ici: Point | null) {
  if (!b.point) throw new Error('lieu sans position')
  const { data, error } = await supabase.rpc('ajouter_lieu', {
    p_nom: b.nom,
    p_latitude: b.point.latitude,
    p_longitude: b.point.longitude,
    p_natures: b.natures,
    p_epoque: b.epoque,
    p_annee: b.annee,
    p_recit: b.recit,
    p_adresse: b.endroit?.adresse ?? '',
    p_images: images,
    p_ma_latitude: ici?.latitude ?? null,
    p_ma_longitude: ici?.longitude ?? null,
  })
  if (error) throw error
  return lireAjout(data)
}
