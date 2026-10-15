/**
 * QUOI     — résume les écoutes de tous les Fragments : total, taux, progression moyenne, dernière écoute.
 * POURQUOI — un taux sur trois écoutes ne dit rien (un seul auditeur qui termine donne 100 %) : `assez`
 *            dit si l'on a de quoi trancher. La progression pèse chaque Fragment par ses écoutes
 *            mesurées, pas par ses écoutes : un Fragment sans durée connue n'y compte pas.
 */
import type { EcouteDUnFragment } from '../api/ecoutes'

export const SEUIL_DECISION = 20

export type ResumeDesEcoutes = {
  ecoutes: number; completions: number; taux: number | null; progression: number | null
  mesurables: number; derniere: string | null; assez: boolean
}

const unChiffre = (n: number) => Math.round(n * 10) / 10

export function resumeDesEcoutes(stats: EcouteDUnFragment[]): ResumeDesEcoutes {
  const ecoutes = stats.reduce((somme, l) => somme + l.ecoutes, 0)
  const completions = stats.reduce((somme, l) => somme + l.completions, 0)
  const mesurables = stats.reduce((somme, l) => somme + (l.progression === null ? 0 : l.mesurables), 0)
  const parcouru = stats.reduce((somme, l) => somme + (l.progression === null ? 0 : l.progression * l.mesurables), 0)
  const dates = stats.flatMap((l) => (l.derniere_ecoute ? [l.derniere_ecoute] : []))
  return {
    ecoutes,
    completions,
    taux: ecoutes > 0 ? unChiffre((100 * completions) / ecoutes) : null,
    progression: mesurables > 0 ? unChiffre(parcouru / mesurables) : null,
    mesurables,
    derniere: dates.reduce<string | null>((plus, d) => (plus === null || new Date(d) > new Date(plus) ? d : plus), null),
    assez: ecoutes >= SEUIL_DECISION,
  }
}
