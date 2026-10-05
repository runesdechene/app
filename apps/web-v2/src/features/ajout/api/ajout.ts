/**
 * QUOI     — tout ce que le parcours « Ajouter un lieu » demande à Supabase (migration 381) : les
 *            natures, les époques, les lieux voisins, l'envoi des photos, et l'ajout.
 * POURQUOI — les photos partent dans le dossier du compte (place-images/places/<moi>/, le rangement
 *            de la V1) : la base refuse toute autre adresse. Les fonctions lisent `auth.uid()` : on
 *            n'envoie jamais qui on est, sauf ce chemin de dossier, que la base revérifie.
 */
import type { Point } from '@/shared/lib/distance'
import { supabase } from '@/shared/supabase/client'
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { envoyerPhotos, type ImageEnvoyee } from '@/shared/supabase/photos'
import type { Champs } from '../components/ChampsDuLieu'
import type { Brouillon } from '../lib/brouillon'
import { lireAjout, lireEpoques, lireFicheAModifier, lireNatures, lireVoisins } from './lireAjout'

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

export async function ajouterLieu(b: Brouillon, images: ImageEnvoyee[], ici: Point | null) {
  if (!b.point) throw new Error('lieu sans position')
  const { data, error } = await supabase.rpc('ajouter_lieu', {
    p_nom: b.nom,
    p_latitude: b.point.latitude,
    p_longitude: b.point.longitude,
    p_natures: b.natures,
    p_recit: b.recit,
    p_adresse: b.endroit?.adresse ?? '',
    p_images: images,
    // Facultatifs (mig 382) : omis quand on ne sait pas. Sans ma position, la base me croit loin.
    ...(b.epoque !== null && { p_epoque: b.epoque }),
    ...(b.annee !== null && { p_annee: b.annee }),
    ...(ici && { p_ma_latitude: ici.latitude, p_ma_longitude: ici.longitude }),
  })
  if (error) throw error
  return lireAjout(data)
}

export async function fetchFicheAModifier(id: string) {
  const { data, error } = await supabase.rpc('lieu_a_modifier', { p_id: id })
  if (error) throw error
  return lireFicheAModifier(data)
}

// Ce qu'on enregistre en modifiant une fiche : les champs de l'ajout, le récit, et les infos en plus
// qu'on a touchées.
export type FicheModifiee = Champs & {
  recit: string
  acces?: string
  quand?: string
  bonASavoir?: string
  bivouacTolere?: boolean
}

// Modifier une fiche (migs 387, 414) : chaque enregistrement est une version. Une info en plus
// absente garde sa valeur en base ; une chaîne vide vide la rubrique.
export async function modifierLieu(id: string, f: FicheModifiee, note: string) {
  const { error } = await supabase.rpc('modifier_lieu', {
    p_id: id,
    p_nom: f.nom,
    p_natures: f.natures,
    p_recit: f.recit,
    ...(f.epoque !== null && { p_epoque: f.epoque }),
    ...(f.annee !== null && { p_annee: f.annee }),
    ...(note.trim() !== '' && { p_note: note }),
    ...(f.acces !== undefined && { p_acces: f.acces }),
    ...(f.quand !== undefined && { p_quand: f.quand }),
    ...(f.bonASavoir !== undefined && { p_bon_a_savoir: f.bonASavoir }),
    ...(f.bivouacTolere !== undefined && { p_bivouac_tolere: f.bivouacTolere }),
  })
  if (error) throw error
}

// Ajouter des photos à un lieu (mig 388) : envoyées dans mon dossier, puis rattachées au lieu.
export async function ajouterPhotosLieu(id: string, photos: PhotoAEnvoyer[]) {
  const images = await envoyerPhotos(photos)
  const { error } = await supabase.rpc('ajouter_photos_lieu', {
    p_id: id,
    p_images: images.map((i) => ({ url: i.url })),
  })
  if (error) throw error
}
