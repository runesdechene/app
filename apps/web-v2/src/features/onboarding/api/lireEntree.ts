/**
 * QUOI     — la forme de ce que l'onboarding lit : « mon entrée » (nom, numéro d'Explorateur, Fragments, Charte signée).
 * POURQUOI — rien n'est supposé : chaque champ est prouvé (migration 370).
 */
import { booleen, nombre, objet, ouNull, chaine } from '@/shared/lib/lire'

export type Entree = {
  nom: string | null
  numero: number
  fragments: number
  charteSignee: boolean
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
