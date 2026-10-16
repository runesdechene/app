/**
 * QUOI     — les dates du Hub : « 14/10/2026 », « 10/2026 », « jamais », « 2 octobre 2026 », « mars 2024 ».
 * POURQUOI — toujours à l'heure de Paris : l'équipe et les joueurs y sont.
 */
const jour = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
const mois = new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })

export function dateCourte(iso: string | null): string {
  return iso ? jour.format(new Date(iso)) : 'jamais'
}

export function moisAnnee(iso: string | null): string {
  return iso ? mois.format(new Date(iso)) : '—'
}

const jourEnLettres = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
const moisEnLettres = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

/** « 2 octobre 2026 ». */
export function dateLongue(iso: string): string {
  return jourEnLettres.format(new Date(iso))
}

/** « mars 2024 ». */
export function moisLong(iso: string): string {
  return moisEnLettres.format(new Date(iso))
}
