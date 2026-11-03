/**
 * QUOI     — ce que le scanner transmet à la fiche d'un Fragment, par l'état de navigation : l'heure du
 *            scan, et si le rescan a choisi de creuser (2 énergies) plutôt que l'anecdote du jour.
 * POURQUOI — l'état de navigation est `unknown` : on le lit ici, une seule fois, pour la route et les
 *            tests. Toute autre forme (retour, rechargement, lien) ne tire rien.
 */
export type ArriveeDuScan = { scan: number; creuser: boolean }

export function lireArrivee(etat: unknown): ArriveeDuScan | null {
  if (typeof etat !== 'object' || etat === null) return null
  if (!('scan' in etat) || typeof etat.scan !== 'number') return null
  return { scan: etat.scan, creuser: 'creuser' in etat && etat.creuser === true }
}
