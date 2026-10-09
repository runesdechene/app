/**
 * QUOI     — lit le JSON de `empreintes_du_scan` (migration 474).
 * POURQUOI — le scanner compare le viseur à ces vecteurs ; une source inconnue est une erreur, pas
 *            une référence de plus.
 */
import { chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Empreinte = { id: number; source: 'illustration' | 'vue'; vecteur: number[] }
export type FragmentScannable = {
  id: number
  nom: string
  illustration: string | null
  empreintes: Empreinte[]
}

function source(v: unknown): Empreinte['source'] {
  const s = chaine(v)
  if (s !== 'illustration' && s !== 'vue') throw new Error(`source inconnue : ${s}`)
  return s
}

function lireEmpreinte(v: unknown): Empreinte {
  const o = objet(v)
  return { id: nombre(o.id), source: source(o.source), vecteur: liste(nombre)(o.vecteur) }
}

function lireFragment(v: unknown): FragmentScannable {
  const o = objet(v)
  return {
    id: nombre(o.id),
    nom: chaine(o.nom),
    illustration: ouNull(chaine)(o.illustration),
    empreintes: liste(lireEmpreinte)(o.empreintes),
  }
}

export const lireEmpreintes = liste(lireFragment)
