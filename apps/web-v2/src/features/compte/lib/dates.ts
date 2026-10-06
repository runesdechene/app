/**
 * QUOI     — les dates du passeport, en français.
 * POURQUOI — pour soi, le jour (« 6 oct. ») ; pour un autre, la base n'envoie que le mois
 *            (migration 431) et l'écran n'affiche que lui (« oct. 2026 »).
 */
import { enDate } from './passeport'

const COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })
const MOIS_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const LONGUE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export function dateCourte(quand: string, auJour: boolean): string {
  return (auJour ? COURTE : MOIS_COURT).format(enDate(quand))
}

export function moisLong(cle: string): string {
  return MOIS_LONG.format(enDate(`${cle}-01`))
}

export function depuis(quand: string, auJour: boolean): string {
  return auJour ? `depuis le ${LONGUE.format(enDate(quand))}` : `depuis ${moisLong(quand.slice(0, 7))}`
}
