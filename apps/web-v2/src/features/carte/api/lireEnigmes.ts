/**
 * QUOI     — les énigmes de la carte lues depuis `enigmes_en_attente`, `ouvrir_enigme` et
 *            `percer_enigme` (spec 2026-10-07-v2-enigmes-design.md).
 * POURQUOI — la liste ne dit que la place (la culture se découvre au toucher) ; la bonne réponse
 *            n'arrive qu'avec le verdict.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type EnigmeEnAttente = { id: number; lat: number; lng: number }
export type Culture = { id: string; nom: string; icone: string | null; couleur: string | null }
export type EnigmeOuverte = {
  numero: number // son numéro fixe, le même pour tous (migration 448)
  culture: Culture
  recit: string
  question: string
  format: 'qcm' | 'free'
  choix: string[] | null
}
export type Verdict = {
  juste: boolean
  reponse: string
  explication: string
  xp: number
  gagnes: number
  points: number
  total: number
  nouveauxTitres: string[]
  prochain: { nom: string; seuil: number } | null
  resteEnAttente: number
  // La jauge du niveau, en part de 0 à 1 : la fête la remplit d'avant à après (comme Découvrir).
  niveau: { niveau: number; avant: number; apres: number }
}

function enAttente(v: unknown): EnigmeEnAttente {
  const o = objet(v)
  return { id: nombre(o.id), lat: nombre(o.lat), lng: nombre(o.lng) }
}

export const lireEnAttente = liste(enAttente)

function culture(v: unknown): Culture {
  const o = objet(v)
  return {
    id: chaine(o.id),
    nom: chaine(o.nom),
    icone: ouNull(chaine)(o.icone),
    couleur: ouNull(chaine)(o.couleur),
  }
}

export function lireOuverture(v: unknown): EnigmeOuverte {
  const o = objet(v)
  return {
    numero: nombre(o.numero),
    culture: culture(o.culture),
    recit: chaine(o.recit),
    question: chaine(o.question),
    format: o.format === 'qcm' ? 'qcm' : 'free',
    choix: ouNull(liste(chaine))(o.choix),
  }
}

function prochain(v: unknown) {
  const o = objet(v)
  return { nom: chaine(o.nom), seuil: nombre(o.seuil) }
}

export function lireVerdict(v: unknown): Verdict {
  const o = objet(v)
  return {
    juste: booleen(o.juste),
    reponse: chaine(o.reponse),
    explication: chaine(o.explication),
    xp: nombre(o.xp),
    gagnes: nombre(o.gagnes),
    points: nombre(o.points),
    total: nombre(o.total),
    nouveauxTitres: liste(chaine)(o.nouveauxTitres),
    prochain: ouNull(prochain)(o.prochain),
    resteEnAttente: nombre(o.resteEnAttente),
    niveau: { niveau: nombre(o.niveau), avant: nombre(o.avant), apres: nombre(o.apres) },
  }
}
