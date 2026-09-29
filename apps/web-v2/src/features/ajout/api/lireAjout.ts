/**
 * QUOI     — la forme de ce que la base rend au parcours « Ajouter un lieu » (migration 381) :
 *            les natures, les époques, les lieux voisins, et la réponse de l'ajout.
 * POURQUOI — rien n'est supposé : chaque champ est prouvé. Une couleur part dans un style : un
 *            hex, rien d'autre.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Nature = { id: string; nom: string; icone: string | null; couleur: string | null }
export type Epoque = { id: string; nom: string }
export type Voisin = {
  id: string
  nom: string
  metres: number
  type: { icone: string | null; couleur: string | null } | null
}
export type Ajout = {
  id: string
  rang: number
  surPlace: boolean
  gain: number
  niveau: number
  avant: number
  apres: number
}

const HEX = /^#[0-9a-f]{6}$/i

function couleur(v: unknown): string | null {
  const c = ouNull(chaine)(v)
  return c && HEX.test(c) ? c : null
}

export const lireNatures = liste((v): Nature => {
  const n = objet(v)
  return {
    id: chaine(n.id),
    nom: chaine(n.nom),
    icone: ouNull(chaine)(n.icone),
    couleur: couleur(n.couleur),
  }
})

export const lireEpoques = liste((v): Epoque => {
  const e = objet(v)
  return { id: chaine(e.id), nom: chaine(e.nom) }
})

export const lireVoisins = liste((v): Voisin => {
  const l = objet(v)
  return {
    id: chaine(l.id),
    nom: chaine(l.nom),
    metres: nombre(l.metres),
    type: ouNull((t) => {
      const o = objet(t)
      return { icone: ouNull(chaine)(o.icone), couleur: couleur(o.couleur) }
    })(l.type),
  }
})

export function lireAjout(json: unknown): Ajout {
  const a = objet(json)
  return {
    id: chaine(a.id),
    rang: nombre(a.rang),
    surPlace: booleen(a.surPlace),
    gain: nombre(a.gain),
    niveau: nombre(a.niveau),
    avant: nombre(a.avant),
    apres: nombre(a.apres),
  }
}

// La fiche telle qu'elle est, pour l'écran « Modifier » (mig 387) ; null : pas visible.
export type Fiche = {
  nom: string
  natures: string[]
  epoque: string | null
  annee: number | null
  recit: string
  photos: { url: string; vignette: string }[]
}

export function lireFicheAModifier(json: unknown): Fiche | null {
  if (json === null) return null
  const f = objet(json)
  return {
    nom: chaine(f.nom),
    natures: liste(chaine)(f.natures),
    epoque: ouNull(chaine)(f.epoque),
    annee: ouNull(nombre)(f.annee),
    recit: chaine(f.recit),
    photos: liste((v) => {
      const p = objet(v)
      return { url: chaine(p.url), vignette: chaine(p.vignette) }
    })(f.photos),
  }
}
