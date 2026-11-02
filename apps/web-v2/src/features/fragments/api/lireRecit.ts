/**
 * QUOI     — le récit d'un Fragment, lu depuis `recit_du_fragment` (migrations 459 et 577 : l'artiste,
 *            sa photo, son mot, la marque d'édition).
 * POURQUOI — `null` quand le Fragment n'existe pas ou est masqué : l'écran le dit.
 */
import { lireEdition, type Edition } from '@/shared/lib/edition'
import { chaine, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Recit = {
  id: number
  nom: string
  heritage: string | null
  illustration: string | null
  resume: string | null
  histoire: string | null // le texte riche de Shopify, lu par `lib/texteRiche.ts`
  audio: string | null
  narrateur: string | null
  origine: string | null
  boutique: string | null
  artiste: string | null
  artistePhoto: string | null
  motArtiste: string | null
  edition: Edition | null
  editionPrecision: string | null
}

export function lireRecit(v: unknown): Recit | null {
  if (v === null) return null
  const o = objet(v)
  const texte = ouNull(chaine)
  return {
    id: nombre(o.id),
    nom: chaine(o.nom),
    heritage: texte(o.heritage),
    illustration: texte(o.illustration),
    resume: texte(o.resume),
    histoire: texte(o.histoire),
    audio: texte(o.audio),
    narrateur: texte(o.narrateur),
    origine: texte(o.origine),
    boutique: texte(o.boutique),
    // Avant la migration 577, ces clés manquent : `?? null` les lit comme vides.
    artiste: texte(o.artiste ?? null),
    artistePhoto: texte(o.artistePhoto ?? null),
    motArtiste: texte(o.motArtiste ?? null),
    edition: lireEdition(o.edition),
    editionPrecision: texte(o.editionPrecision ?? null),
  }
}
