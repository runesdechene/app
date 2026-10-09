/**
 * QUOI     — une durée en secondes, comme un lecteur l'écrit : « 0:51 », « 3:42 ».
 */
export function duree(secondes: number): string {
  const s = Number.isFinite(secondes) ? Math.max(0, Math.floor(secondes)) : 0
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`
}
