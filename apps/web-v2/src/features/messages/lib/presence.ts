/**
 * QUOI     — la ligne sous le nom d'un correspondant : « Dernière connexion il y a 2 j (Finistère) ».
 * POURQUOI — maquette 264:162, validée par Uriel le 28/09 : une trace douce, jamais « en ligne ».
 *            La région n'y est que si la personne la montre (la base ne la rend pas sinon).
 */
import { ilYA } from '@/shared/lib/ilYA'
import type { Correspondant } from '../api/lireMurmures'

export function presence(
  c: Pick<Correspondant, 'derniereConnexion' | 'region'>,
): string | undefined {
  const region = c.region ? ` (${c.region})` : ''
  if (c.derniereConnexion) return `Dernière connexion ${ilYA(c.derniereConnexion)}${region}`
  return c.region ?? undefined
}
