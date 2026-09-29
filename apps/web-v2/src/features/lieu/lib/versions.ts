/**
 * QUOI     — ce qu'une version a changé, en mots : « a enrichi le récit », « a changé la nature et
 *            l'époque », « a ajouté le lieu ».
 * POURQUOI — l'histoire de la fiche se lit comme un carnet, pas comme un journal technique.
 */
import type { Version } from '../api/lireLieu'

const MOTS: Record<string, string> = {
  nom: 'le nom',
  natures: 'la nature',
  epoque: 'l’époque',
  recit: 'le récit',
}

export function ceQuiAChange(v: Version): string {
  if (v.origine) return 'a ajouté le lieu'
  const champs = v.champs.map((c) => MOTS[c]).filter((m) => m !== undefined)
  if (champs.length === 1 && champs[0] === 'le récit') return 'a enrichi le récit'
  if (champs.length === 0) return 'a modifié la fiche'
  const liste =
    champs.length === 1
      ? champs[0]
      : `${champs.slice(0, -1).join(', ')} et ${champs[champs.length - 1] ?? ''}`
  return `a changé ${liste ?? ''}`
}
