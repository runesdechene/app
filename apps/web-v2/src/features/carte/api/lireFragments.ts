/**
 * QUOI     — les Fragments de la carte, lus depuis `fragments_sur_la_carte` (migration 458).
 * POURQUOI — chaque Fragment visible qui a une origine, avec la petite icône de son illustration.
 */
import { chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type FragmentSurLaCarte = {
  id: number
  nom: string
  illustration: string | null
  heritage: string | null
  origine: string | null
  lat: number
  lng: number
}

function fragment(v: unknown): FragmentSurLaCarte {
  const o = objet(v)
  return {
    id: nombre(o.id),
    nom: chaine(o.nom),
    illustration: ouNull(chaine)(o.illustration),
    heritage: ouNull(chaine)(o.heritage),
    origine: ouNull(chaine)(o.origine),
    lat: nombre(o.lat),
    lng: nombre(o.lng),
  }
}

export const lireFragments = liste(fragment)
