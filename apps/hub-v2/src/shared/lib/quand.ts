/**
 * QUOI     — « il y a 12 min », « il y a 3 h », « hier », « il y a 3 jours ».
 */
const MINUTE = 60_000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

export function depuis(iso: string, maintenant: Date = new Date()): string {
  const ecoule = maintenant.getTime() - new Date(iso).getTime()
  if (ecoule < HEURE) return `il y a ${String(Math.max(1, Math.round(ecoule / MINUTE)))} min`
  if (ecoule < JOUR) return `il y a ${String(Math.round(ecoule / HEURE))} h`
  const jours = Math.floor(ecoule / JOUR)
  return jours === 1 ? 'hier' : `il y a ${String(jours)} jours`
}

const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const jourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** « 14:32 » aujourd'hui, « hier 14:32 », puis « 12 oct. 14:32 » (heure locale du navigateur). */
export function heureDuFil(iso: string, maintenant: Date = new Date()): string {
  const quand = new Date(iso)
  const debutDuJour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  const debutDHier = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 1)
  if (quand >= debutDuJour) return heure.format(quand)
  if (quand >= debutDHier) return `hier ${heure.format(quand)}`
  return `${jourMois.format(quand)} ${heure.format(quand)}`
}
