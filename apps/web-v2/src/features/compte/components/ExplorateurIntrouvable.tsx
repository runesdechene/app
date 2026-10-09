/**
 * QUOI     — ce qu'on voit à l'adresse d'un Explorateur qui n'existe pas (ou plus).
 * POURQUOI — un lien partagé peut viser un compte supprimé : on le dit, simplement. Le retour
 *            est la flèche du cadre de détail, comme partout.
 */
import { EmptyState } from '@/shared/ui/EmptyState'

export function ExplorateurIntrouvable() {
  return <EmptyState>Cet Explorateur est introuvable</EmptyState>
}
