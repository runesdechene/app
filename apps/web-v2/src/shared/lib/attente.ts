/**
 * QUOI     — une attente lisible : « 23 min », « 1 h », « 1 h 24 ».
 * POURQUOI — la jauge d'énergie et le voile de découverte disent quand revient le prochain point.
 */
export function attente(secondes: number): string {
  const minutes = Math.max(1, Math.ceil(secondes / 60))
  if (minutes < 60) return `${String(minutes)} min`
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  return reste === 0
    ? `${String(heures)} h`
    : `${String(heures)} h ${String(reste).padStart(2, '0')}`
}
