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
