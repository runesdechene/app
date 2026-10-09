/**
 * QUOI     — un rang en chiffres romains (1 → I, 14 → XIV), pour les Grands Explorateurs.
 * POURQUOI — la maquette 275:128 écrit les rangs comme sur une stèle, en IM Fell.
 */
const CHIFFRES: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

export function romain(n: number): string {
  let reste = n
  let texte = ''
  for (const [valeur, chiffre] of CHIFFRES) {
    while (reste >= valeur) {
      texte += chiffre
      reste -= valeur
    }
  }
  return texte
}
