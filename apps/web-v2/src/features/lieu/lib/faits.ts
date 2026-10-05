/**
 * QUOI     — la ligne de faits sous le type : l'époque et le siècle.
 * POURQUOI — elle répond aux questions de qui envisage d'y aller ; elle ne dit que ce qui est
 *            connu, et disparaît sinon (spec fiche §2).
 */
import type { FicheLieu } from '../api/lireLieu'

function romain(n: number): string {
  const table: [number, string][] = [
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
  let reste = n
  return table.reduce((acc, [valeur, lettres]) => {
    const fois = Math.floor(reste / valeur)
    reste -= fois * valeur
    return acc + lettres.repeat(fois)
  }, '')
}

function siecle(annee: number): string {
  const n = Math.floor((Math.abs(annee) - 1) / 100) + 1
  const ordinal = n === 1 ? 'ᵉʳ' : 'ᵉ'
  return `${romain(n)}${ordinal} siècle${annee < 0 ? ' av. J.-C.' : ''}`
}

export function ligneDeFaits(f: FicheLieu['faits']): string | null {
  const morceaux = [f.epoque, f.annee === null ? null : siecle(f.annee)].filter(
    (m): m is string => m !== null,
  )
  return morceaux.length > 0 ? morceaux.join(' · ') : null
}
