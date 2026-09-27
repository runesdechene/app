/**
 * QUOI     — les adresses de la zone Compte, branchées sur la coquille.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail et la fonction de fermeture.
 */
import { useParams } from 'react-router'
import { MenuAvatar } from '@/features/compte/components/MenuAvatar'
import { ProfilExplorateur } from '@/features/compte/components/ProfilExplorateur'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { useFermerDetail } from '../navigation/useFermerDetail'
import { DetailPane } from '../shell/DetailPane'

// /<onglet>/menu
export function RouteMenu() {
  return <MenuAvatar onFermer={useFermerDetail()} />
}

// /<onglet>/explorateur/<id>
export function RouteExplorateur() {
  const { id = '' } = useParams()
  const moi = useMonIdentifiant()
  return (
    <DetailPane title={id === moi ? 'Mon profil' : 'Profil'}>
      <ProfilExplorateur id={id} />
    </DetailPane>
  )
}
