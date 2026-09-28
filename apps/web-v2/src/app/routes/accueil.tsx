/**
 * QUOI     — les adresses de la zone Accueil, branchées sur la coquille.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail.
 */
import { PageClassement } from '@/features/accueil/components/PageClassement'
import { DetailPane } from '../shell/DetailPane'

// /<onglet>/classement — « Voir tout le classement », depuis l'Accueil.
export function RouteClassement() {
  return (
    <DetailPane title="Les Grands Explorateurs">
      <PageClassement />
    </DetailPane>
  )
}
