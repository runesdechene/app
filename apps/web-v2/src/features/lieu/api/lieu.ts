/**
 * QUOI     — tout ce que la fiche d'un lieu demande à Supabase (migrations 364-367).
 * POURQUOI — chaque fonction rend une donnée typée ou lève : jamais un `{ error }` à vérifier
 *            plus loin. Les fonctions de la base lisent `auth.uid()` : on n'envoie jamais qui on est.
 */
import { booleen, chaine, liste, objet } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'
import type { Point } from '@/shared/lib/distance'
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { envoyerPhotos } from '@/shared/supabase/photos'
import {
  lireCarnet,
  lireCoeurs,
  lireCompagnons,
  lireCoutDecouverte,
  lireHistoire,
  lireExplorateurs,
  lireFiche,
  lireRecompense,
} from './lireLieu'

export async function fetchFiche(id: string) {
  const { data, error } = await supabase.rpc('fiche_lieu', { p_id: id })
  if (error) throw error
  return lireFiche(data)
}

export async function fetchExplorateurs(id: string) {
  const { data, error } = await supabase.rpc('explorateurs_du_lieu', { p_id: id })
  if (error) throw error
  return lireExplorateurs(data)
}

export async function basculerEnvie(id: string) {
  const { data, error } = await supabase.rpc('basculer_envie', { p_id: id })
  if (error) throw error
  return booleen(data)
}

// Découvrir depuis ma position : au-delà de 100 km, la base fait payer de l'énergie (399).
export async function decouvrirLieu(id: string, position: Point | null) {
  const { data, error } = await supabase.rpc('decouvrir_lieu', {
    p_id: id,
    p_lat: position?.latitude ?? null,
    p_lng: position?.longitude ?? null,
  })
  if (error) throw error
  return lireRecompense(data)
}

export async function fetchCoutDecouverte(id: string, position: Point | null) {
  const { data, error } = await supabase.rpc('cout_decouverte', {
    p_id: id,
    p_lat: position?.latitude ?? null,
    p_lng: position?.longitude ?? null,
  })
  if (error) throw error
  return lireCoutDecouverte(data)
}

export async function visiterLieu(id: string, lat: number, lng: number) {
  const { data, error } = await supabase.rpc('visiter_lieu', { p_id: id, p_lat: lat, p_lng: lng })
  if (error) throw error
  return chaine(objet(data).visiteLe)
}

export async function signalerPresence(lat: number, lng: number) {
  const { error } = await supabase.rpc('signaler_presence', { p_lat: lat, p_lng: lng })
  if (error) throw error
}

export async function fetchCompagnons(id: string) {
  const { data, error } = await supabase.rpc('compagnons_possibles', { p_id: id })
  if (error) throw error
  return lireCompagnons(data)
}

export async function fetchNomsExpedition() {
  const { data, error } = await supabase.rpc('mes_noms_d_expedition')
  if (error) throw error
  return liste(chaine)(data)
}

export async function revendiquerLieu(id: string, compagnons: string[], nom: string | null) {
  const { data, error } = await supabase.rpc('revendiquer_lieu', {
    p_id: id,
    p_compagnons: compagnons,
    p_nom: nom ?? '',
  })
  if (error) throw error
  return chaine(objet(data).nom)
}

// Qui regarde : son identifiant, et s'il est admin (le rôle voyage dans le jeton, mig 179).
export async function fetchMoi() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const user = data.session?.user
  if (!user) throw new Error('sans session')
  return { id: user.id, admin: objet(user.app_metadata).user_role === 'admin' }
}

// delete_place (V1, gardée par la 347) : auteur ou admin, vérifié en base. Elle rend son refus
// ({ error }) au lieu de le lever ; la cascade emporte les visites et les découvertes.
export async function supprimerLieu(id: string, moi: string) {
  const { data, error } = await supabase.rpc('delete_place', { p_user_id: moi, p_place_id: id })
  if (error) throw error
  const refus = objet(data).error
  if (refus !== undefined) throw new Error(chaine(refus))
}

export async function fetchCoeurs(id: string) {
  const { data, error } = await supabase.rpc('coeurs_du_lieu', { p_id: id })
  if (error) throw error
  return lireCoeurs(data)
}

// Un cœur de plus (mig 384) : à volonté, jamais sur son propre lieu.
export async function aimerLieu(id: string) {
  const { error } = await supabase.rpc('aimer_lieu', { p_id: id })
  if (error) throw error
}

export async function fetchHistoire(id: string) {
  const { data, error } = await supabase.rpc('histoire_du_lieu', { p_id: id })
  if (error) throw error
  return lireHistoire(data)
}

// Reposer une version (mig 387) : les mêmes règles que modifier, et une version de plus.
export async function revenirAVersion(version: number) {
  const { error } = await supabase.rpc('revenir_a_version', { p_version: version })
  if (error) throw error
}

export type Raison = 'n_existe_pas' | 'prive_ou_dangereux' | 'doublon' | 'contenu' | 'autre'

export async function signalerLieu(id: string, raison: Raison, precision: string) {
  const { error } = await supabase.rpc('signaler_lieu', {
    p_id: id,
    p_raison: raison,
    p_precision: precision,
  })
  if (error) throw error
}

// Le Carnet de passage (mig 389) : les mots d'un lieu (les premiers seulement, pour la fiche).
export async function fetchCarnet(id: string, limite: number | null) {
  const { data, error } = await supabase.rpc('carnet_du_lieu', {
    p_id: id,
    ...(limite !== null && { p_limite: limite }),
  })
  if (error) throw error
  return lireCarnet(data)
}

// Écrire au carnet : les photos partent d'abord dans mon dossier, puis le mot.
export async function ecrireAuCarnet(
  id: string,
  texte: string,
  photos: PhotoAEnvoyer[],
  parent: number | null,
) {
  const images = photos.length > 0 ? await envoyerPhotos(photos) : []
  const { error } = await supabase.rpc('ecrire_au_carnet', {
    p_id: id,
    p_texte: texte,
    p_images: images.map((i) => ({ url: i.url })),
    ...(parent !== null && { p_parent: parent }),
  })
  if (error) throw error
}

// Un cœur par personne sur un mot (mig 390) : il s'allume ou s'éteint.
export async function basculerCoeurMot(id: number) {
  const { error } = await supabase.rpc('basculer_coeur_mot', { p_id: id })
  if (error) throw error
}

export async function effacerMot(id: number) {
  const { error } = await supabase.rpc('effacer_mot', { p_id: id })
  if (error) throw error
}
