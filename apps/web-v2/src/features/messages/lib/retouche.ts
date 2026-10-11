/**
 * QUOI     — le temps pour modifier son message : quinze minutes (Uriel, 11/10).
 * POURQUOI — la base fait foi (migration 502) ; l'écran ne propose « Modifier » que dans ce délai.
 */
const QUINZE_MINUTES_MS = 15 * 60 * 1000

export function encoreModifiable(quand: string, maintenant = Date.now()) {
  return maintenant - Date.parse(quand) < QUINZE_MINUTES_MS
}
