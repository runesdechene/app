/**
 * QUOI     — l'écart entre deux textes, mot à mot : ce qui reste, ce qui est ajouté, ce qui est retiré.
 * POURQUOI — l'histoire montre « ce que chacun a ajouté » (Uriel, 05/10) ; la comparaison est celle de
 *            jsdiff (`diffWords`), l'outil standard, pas un algorithme maison.
 */
import { diffWords } from 'diff'

export type Morceau = { texte: string; genre: 'pareil' | 'ajoute' | 'retire' }

export function ecart(avant: string, apres: string): Morceau[] {
  return diffWords(avant, apres).map((p) => ({
    texte: p.value,
    genre: p.added ? 'ajoute' : p.removed ? 'retire' : 'pareil',
  }))
}
