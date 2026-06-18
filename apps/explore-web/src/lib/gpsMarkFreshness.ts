/** Âge d'une marque en jours pleins (arrondi bas). */
export function gpsMarkAgeDays(createdAt: string, nowMs: number = Date.now()): number {
  const ms = nowMs - new Date(createdAt).getTime()
  return Math.floor(ms / 86_400_000)
}

/** La marque ouvre-t-elle encore droit au bonus GPS rétroactif ?
 *  Vrai tant que l'âge ≤ freshnessDays (défaut 30, cf. app_settings). */
export function isGpsMarkFresh(createdAt: string, nowMs: number = Date.now(), freshnessDays = 30): boolean {
  return gpsMarkAgeDays(createdAt, nowMs) <= freshnessDays
}
