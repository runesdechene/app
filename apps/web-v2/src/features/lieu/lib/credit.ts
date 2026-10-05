/**
 * QUOI     — sous « Lieu ajouté par… », la ligne « Récit enrichi par X et Y » : ceux qui ont écrit le
 *            récit, hors l'auteur du lieu, par ordre d'arrivée ; et la liaison entre leurs noms.
 * POURQUOI — deux lignes de crédit, l'ajout puis l'enrichissement : plus clair qu'un « Récit partagé »
 *            sous le texte (Uriel, 05/10).
 */
import type { Personne } from '../api/lireLieu'

export function enrichisseurs(recitPar: Personne[], auteur: string | null): Personne[] {
  return recitPar.filter((p) => p.id !== auteur)
}

// Ce qui précède le i-ème nom d'une liste de n : « A », « A et B », « A, B et C ».
export function liaison(i: number, n: number): string {
  if (i === 0) return ''
  return i === n - 1 ? ' et ' : ', '
}
