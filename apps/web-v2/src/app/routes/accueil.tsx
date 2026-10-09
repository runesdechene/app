/**
 * QUOI     — les adresses de la zone Accueil, branchées sur la coquille.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail.
 */
import { PageChemins } from '@/features/accueil/components/PageChemins'
import { PageClassement } from '@/features/accueil/components/PageClassement'
import { DetailPane } from '../shell/DetailPane'

// /<onglet>/classement — « Voir tout le classement », depuis l'Accueil.
export function RouteClassement() {
  return (
    <DetailPane title="Le Panthéon">
      <PageClassement />
    </DetailPane>
  )
}

// /<onglet>/chemins — « Voir toute l'activité », depuis l'Accueil.
export function RouteChemins() {
  return (
    <DetailPane title="Sur les chemins">
      <PageChemins />
    </DetailPane>
  )
}
