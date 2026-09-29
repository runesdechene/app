/**
 * QUOI     — les phrases des cœurs d'un lieu : qui en a envoyé, et qui féliciter.
 * POURQUOI — sous les crédits, une ligne dit qui a aimé le lieu (« Kelpie, Luna et 4 autres ont
 *            envoyé 42 cœurs ») ; le bouton nomme ceux qu'on félicite (l'auteur, qui l'a enrichi).
 */
import type { Coeurs } from '../api/lireLieu'

const coeurs = (n: number) => `${String(n)} ${n > 1 ? 'cœurs' : 'cœur'}`

export function phraseDesCoeurs(gens: Coeurs['gens'], total: number) {
  const [a, b, ...autres] = gens.map((p) => p.nom)
  if (!a) return ''
  if (!b) return `${a} a envoyé ${coeurs(total)}`
  if (autres.length === 0) return `${a} et ${b} ont envoyé ${coeurs(total)}`
  const reste = `${String(autres.length)} ${autres.length > 1 ? 'autres' : 'autre'}`
  return `${a}, ${b} et ${reste} ont envoyé ${coeurs(total)}`
}

export function libelleFeliciter(noms: string[]) {
  const uniques = [...new Set(noms)]
  return uniques.length === 0 ? 'Aimer ce lieu' : `Féliciter ${uniques.join(' et ')}`
}
