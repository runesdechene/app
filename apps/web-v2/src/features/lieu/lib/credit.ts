/**
 * QUOI     — la phrase de crédit sous le récit : « Récit de Luna », « Récit partagé de Luna, Mathéo et
 *            Aelis ».
 * POURQUOI — tous à égalité, par ordre d'arrivée (Uriel, 05/10 : « parfois l'auteur de base met 3
 *            lignes, et les suivants font tout le boulot »).
 */
export function phraseDuRecit(noms: string[]): string | null {
  if (noms.length === 0) return null
  if (noms.length === 1) return `Récit de ${noms[0] ?? ''}`
  return `Récit partagé de ${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1] ?? ''}`
}
