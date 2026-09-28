/**
 * QUOI     — les adresses de la zone Carte et de l'en-tête, branchées sur la coquille : la feuille
 *            « Ajouter » et les notifications.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail et la fonction de fermeture.
 * ATTENTION — les notifications arrivent plus tard ; la fiche d'un lieu vit dans lieu.tsx.
 */
import { AjouterFeuille } from '@/features/carte/components/AjouterFeuille'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useFermerDetail } from '../navigation/useFermerDetail'
import { DetailPane } from '../shell/DetailPane'

// /<onglet>/ajouter — la feuille du « + » (maquette 201:216)
export function RouteAjouter() {
  return <AjouterFeuille onFermer={useFermerDetail()} />
}

// /<onglet>/notifications
export function RouteNotifications() {
  return (
    <DetailPane title="Notifications">
      <EmptyState>Rien de nouveau</EmptyState>
    </DetailPane>
  )
}
