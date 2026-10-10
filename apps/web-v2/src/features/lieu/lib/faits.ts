/**
 * QUOI     — la ligne de faits sous le type : l'époque et le siècle.
 * POURQUOI — elle répond aux questions de qui envisage d'y aller ; elle ne dit que ce qui est
 *            connu, et disparaît sinon (spec fiche §2). Le siècle suit le calendrier du joueur
 *            (spec calendrier) ; le calcul vit dans `@runes/calendrier`.
 */
import { siecleEnClair, type Calendrier } from '@runes/calendrier'
import type { FicheLieu } from '../api/lireLieu'

export function ligneDeFaits(f: FicheLieu['faits'], calendrier: Calendrier): string | null {
  const morceaux = [f.epoque, f.annee === null ? null : siecleEnClair(f.annee, calendrier)].filter(
    (m): m is string => m !== null,
  )
  return morceaux.length > 0 ? morceaux.join(' · ') : null
}
