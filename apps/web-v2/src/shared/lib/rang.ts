/**
 * QUOI     — le rang d'un numéro de Porteur, dit par les trois raretés du Codex.
 * POURQUOI — spec du Codex (Uriel, 02/11) : n° 1-10 rare, 11-50 peu commune, au-delà commune.
 *            Des seuils fixes : un numéro garde son rang quand le motif gagne des Porteurs.
 */
export type Rarete = 'commune' | 'peu_commune' | 'rare'

export function rangDuNumero(numero: number): Rarete {
  if (numero <= 10) return 'rare'
  if (numero <= 50) return 'peu_commune'
  return 'commune'
}
