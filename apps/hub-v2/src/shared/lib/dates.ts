/**
 * QUOI     — les dates des listes du Hub : « 14/10/2026 », « 10/2026 », « jamais ».
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
