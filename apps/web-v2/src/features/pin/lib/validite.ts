/**
 * QUOI     — le temps qui reste à un pin pour rester « sur place », en jours et en mots.
 * POURQUOI — Uriel, 06/10 : un pin vaut 15 jours, et chaque pin le dit dès la pose. La base garde
 *            la vraie règle (`_pin_frais`, réglage `place_draft_freshness_days`) ; ceci l'annonce.
 */
const JOUR = 24 * 60 * 60 * 1000

export const VALIDITE_JOURS = 15

// Jours entamés qui restent : 15 le jour de la pose, 1 la dernière journée, 0 ou moins ensuite.
export function joursRestants(poseLe: Date, maintenant: Date, validite = VALIDITE_JOURS): number {
  return Math.ceil((poseLe.getTime() + validite * JOUR - maintenant.getTime()) / JOUR)
}

export function dureeRestante(jours: number): string {
  if (jours <= 0) return 'sera ajouté à distance'
  return jours === 1 ? 'encore 1 jour' : `encore ${String(jours)} jours`
}
