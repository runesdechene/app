/**
 * QUOI     — les règles d'une mise à jour : longueurs du titre et du texte, images acceptées, nom du fichier.
 * POURQUOI — les mêmes bornes que la base (titre 80, texte 3000) et que le bucket announcement-covers
 *            (jpeg, png, webp, gif, 10 Mo) : un refus se dit avant l'envoi, pas après.
 */
import { extensionDe, type RegleFichier } from '@/shared/lib/envoi'

export const TITRE_MAX = 80
export const TEXTE_MAX = 3000
export const BUCKET = 'announcement-covers'
export const REGLE_IMAGE: RegleFichier = { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxOctets: 10 * 1024 * 1024 }

export const cheminDeImage = (fichier: File, prefixe = 'mise-a-jour') => `${prefixe}-${String(Date.now())}.${extensionDe(fichier)}`

export function estPubliable(titre: string, texte: string): boolean {
  const t = titre.trim().length
  const x = texte.trim().length
  return t >= 1 && t <= TITRE_MAX && x >= 1 && x <= TEXTE_MAX
}
