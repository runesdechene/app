/**
 * QUOI     — où une photo est publiée, et le tri placées / non placées de la vue « Photos ».
 */
import type { PhotoPubliee } from '../api/photos'

export type Placement = 'toutes' | 'placees' | 'non_placees'
export const PLACEMENTS: { valeur: Placement; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes' }, { valeur: 'placees', libelle: 'Placées' },
  { valeur: 'non_placees', libelle: 'Non placées' },
]

/** Placée : avec son avis, sur la fiche produit Shopify, au mur « Ils nous portent » ou dans la communauté. */
export const estPlacee = (p: PhotoPubliee) => p.avis || p.fiche || p.mur || p.communaute

export function selonPlacement(photos: PhotoPubliee[], placement: Placement): PhotoPubliee[] {
  if (placement === 'toutes') return photos
  return photos.filter((p) => estPlacee(p) === (placement === 'placees'))
}
