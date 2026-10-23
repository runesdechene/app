/**
 * QUOI     — la lettre telle qu'elle part : chaque photo qui penche, préparée penchée sur la couleur du moment.
 * POURQUOI — un e-mail ne sait pas pencher une image. Le brouillon garde les photos droites (l'éditeur les penche
 *            à l'écran, aux couleurs du moment) ; on ne les cuit qu'à l'essai ou à la programmation, pour que
 *            changer de palette ne laisse jamais de coins à l'ancienne couleur (bug relevé par Uriel, 23/10).
 */
import { deduireCouleurs, photosPenchees, type Couleurs, type Lettre } from '@runes/missives'
import { changerZoneDeLettre } from './brouillon'

/** Prépare une photo : son adresse d'origine, son inclinaison, la couleur de ses coins ; rend l'adresse préparée. */
export type Cuire = (url: string, degres: number, couleur: string) => Promise<string>

export async function lettrePourEnvoi(lettre: Lettre, couleurs: Couleurs, cuire: Cuire): Promise<Lettre> {
  const c = deduireCouleurs(couleurs)
  let pret = lettre
  for (const p of photosPenchees(lettre)) {
    pret = changerZoneDeLettre(pret, p.zone, await cuire(p.url, p.degres, p.sur === 'rupture' ? c.rupture : c.fond))
  }
  return pret
}
