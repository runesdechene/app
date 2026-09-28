/**
 * QUOI     — la forme de ce que l'onboarding lit : les deux chiffres de l'accueil, et « mon
 *            entrée » (nom, numéro d'Explorateur, Fragments, Charte signée).
 * POURQUOI — rien n'est supposé : chaque champ est prouvé (migration 370, get_landing_stats).
 */
import { booleen, liste, nombre, objet, ouNull, chaine } from '@/shared/lib/lire'

export type Chiffres = { lieux: number; explorateurs: number }
export type Entree = {
  nom: string | null
  numero: number
  fragments: number
  charteSignee: boolean
}

export function lireChiffres(json: unknown): Chiffres {
  const [ligne] = liste(objet)(json)
  if (!ligne) throw new Error('chiffres absents')
  return { lieux: nombre(ligne.total_places), explorateurs: nombre(ligne.total_users) }
}

export function lireEntree(json: unknown): Entree {
  const e = objet(json)
  return {
    nom: ouNull(chaine)(e.nom),
    numero: nombre(e.numero),
    fragments: nombre(e.fragments),
    charteSignee: booleen(e.charteSignee),
  }
}
