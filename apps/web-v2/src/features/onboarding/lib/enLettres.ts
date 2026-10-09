/**
 * QUOI     — un petit nombre en lettres : « Deux Fragments t'attendent », pas « 2 Fragments ».
 * POURQUOI — la maquette 94:372 l'écrit ainsi ; au-delà de dix, le chiffre se lit mieux.
 */
const MOTS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix']

export function enLettres(n: number): string {
  return MOTS[n] ?? String(n)
}

export function majuscule(mot: string): string {
  return mot.charAt(0).toUpperCase() + mot.slice(1)
}
