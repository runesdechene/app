/**
 * QUOI     — mes énigmes, lues depuis `mes_enigmes` et `mes_enigmes_culture` (migration 447) : combien
 *            j'en ai résolu sur le total, par culture, et ce que j'ai appris dans une culture.
 * POURQUOI — la page « Les énigmes » (maquettes 478:452 et 478:526) : la base compte, le front lit.
 */
import { chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type CultureResolue = {
  id: string
  nom: string
  icone: string | null
  couleur: string | null
  resolues: number
  total: number
}
export type MesEnigmes = { resolues: number; total: number; cultures: CultureResolue[] }
export type EnigmeApprise = { reponse: string; question: string; explication: string; le: string }
export type MaCulture = {
  culture: { id: string; nom: string; icone: string | null; couleur: string | null; zone: string | null }
  resolues: number
  total: number
  centre: { lat: number; lng: number } | null
  enigmes: EnigmeApprise[]
}

const texteOuNull = ouNull(chaine)

function cultureResolue(v: unknown): CultureResolue {
  const o = objet(v)
  return {
    id: chaine(o.id),
    nom: chaine(o.nom),
    icone: texteOuNull(o.icone),
    couleur: texteOuNull(o.couleur),
    resolues: nombre(o.resolues),
    total: nombre(o.total),
  }
}

export function lireMesEnigmes(v: unknown): MesEnigmes {
  const o = objet(v)
  return { resolues: nombre(o.resolues), total: nombre(o.total), cultures: liste(cultureResolue)(o.cultures) }
}

function enigmeApprise(v: unknown): EnigmeApprise {
  const o = objet(v)
  return { reponse: chaine(o.reponse), question: chaine(o.question), explication: chaine(o.explication), le: chaine(o.le) }
}

function centre(v: unknown) {
  const o = objet(v)
  return { lat: nombre(o.lat), lng: nombre(o.lng) }
}

export function lireMaCulture(v: unknown): MaCulture {
  const o = objet(v)
  const c = objet(o.culture)
  return {
    culture: {
      id: chaine(c.id),
      nom: chaine(c.nom),
      icone: texteOuNull(c.icone),
      couleur: texteOuNull(c.couleur),
      zone: texteOuNull(c.zone),
    },
    resolues: nombre(o.resolues),
    total: nombre(o.total),
    centre: ouNull(centre)(o.centre),
    enigmes: liste(enigmeApprise)(o.enigmes),
  }
}
