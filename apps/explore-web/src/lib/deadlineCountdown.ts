/**
 * Compte à rebours humain jusqu'à une échéance ISO (date limite d'un défi /
 * d'une mission). Renvoie :
 *   - null         si pas de date (ou date invalide)
 *   - 'Terminé'    si l'échéance est dépassée
 *   - 'Dernier jour' s'il reste moins de 24 h
 *   - 'Plus que N jours' sinon
 *
 * Volontairement au jour près : les fenêtres de défis se clôturent sur une
 * frontière de jour (reset quotidien / lundi 00 h), une précision horaire
 * n'apporterait rien et brouillerait le message.
 */
export function formatDeadlineCountdown(endsAt: string | null | undefined): string | null {
  if (!endsAt) return null
  const end = new Date(endsAt).getTime()
  if (Number.isNaN(end)) return null
  const ms = end - Date.now()
  if (ms <= 0) return 'Terminé'
  const days = Math.ceil(ms / 86_400_000)
  if (days <= 1) return 'Dernier jour'
  return `Plus que ${days} jours`
}
