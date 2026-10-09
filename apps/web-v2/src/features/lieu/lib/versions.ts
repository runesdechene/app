/**
 * QUOI     — ce qu'une version a changé, en mots : « a enrichi le récit », « a enrichi l'accès »,
 *            « a changé la nature et l'époque », « a ajouté le lieu ».
 * POURQUOI — l'histoire de la fiche se lit comme un carnet, pas comme un journal technique.
 */
import type { Version } from '../api/lireLieu'

const MOTS: Record<string, string> = {
  nom: 'le nom',
  natures: 'la nature',
  epoque: 'l’époque',
  recit: 'le récit',
  acces: 'l’accès',
  quand: '« Quand y aller »',
  bon_a_savoir: '« Bon à savoir »',
  bivouac: 'le bivouac',
}
// Le récit et les rubriques s'enrichissent ; le reste se change.
const ENRICHIS = new Set(['recit', 'acces', 'quand', 'bon_a_savoir'])

function enListe(mots: string[]) {
  return mots.length === 1
    ? (mots[0] ?? '')
    : `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1] ?? ''}`
}

export function ceQuiAChange(v: Version): string {
  if (v.origine) return 'a ajouté le lieu'
  const connus = v.champs.filter((c) => MOTS[c] !== undefined)
  if (connus.length === 0) return 'a modifié la fiche'
  const mots = connus.map((c) => MOTS[c] ?? '')
  return `${connus.every((c) => ENRICHIS.has(c)) ? 'a enrichi' : 'a changé'} ${enListe(mots)}`
}
