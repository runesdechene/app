/**
 * QUOI     — la mise à jour à montrer sur la page Explore : la dernière parue, si elle a moins de
 *            14 jours ou n'est pas encore lue ; sinon aucune.
 * POURQUOI — Uriel, 11/10 : une carte toujours là devient du décor ; elle s'efface d'elle-même.
 */
import type { MiseAJour } from '../api/nouveautes'

const QUATORZE_JOURS = 14 * 86_400_000

export function aMontrerALAccueil(misesAJour: MiseAJour[], maintenant: Date): MiseAJour | null {
  const [derniere] = misesAJour
  if (!derniere) return null
  const recente = maintenant.getTime() - new Date(derniere.quand).getTime() < QUATORZE_JOURS
  return recente || !derniere.lue ? derniere : null
}
