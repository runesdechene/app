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
// `numero` : son numéro fixe, le même pour tous (migration 448).
export type EnigmeApprise = { numero: number; reponse: string; question: string; explication: string; le: string }
// Mon grade dans la culture et le titre suivant, avec ce qui manque en points (migration 452).
export type Grade = { titre: string; rang: number }
export type Prochain = { titre: string; rang: number; manque: number }
export type MaCulture = {
  // presentation : le portrait de la culture, réglé dans le Hub (migration 450).
  culture: {
    id: string
    nom: string
    icone: string | null
    couleur: string | null
    zone: string | null
    presentation: string | null
  }
  resolues: number
  total: number
  grade: Grade | null
  prochain: Prochain | null
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
  return { numero: nombre(o.numero), reponse: chaine(o.reponse), question: chaine(o.question), explication: chaine(o.explication), le: chaine(o.le) }
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
      presentation: texteOuNull(c.presentation ?? null),
    },
    resolues: nombre(o.resolues),
    total: nombre(o.total),
    // Absents avant la migration 452 : aucun.
    grade: o.grade === undefined ? null : ouNull(grade)(o.grade),
    prochain: o.prochain === undefined ? null : ouNull(prochain)(o.prochain),
    centre: ouNull(centre)(o.centre),
    enigmes: liste(enigmeApprise)(o.enigmes),
  }
}

function grade(v: unknown): Grade {
  const o = objet(v)
  return { titre: chaine(o.titre), rang: nombre(o.rang) }
}

function prochain(v: unknown): Prochain {
  const o = objet(v)
  return { titre: chaine(o.titre), rang: nombre(o.rang), manque: nombre(o.manque) }
}
