/**
 * QUOI     — les adresses de la zone Compte, branchées sur la coquille.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail et la fonction de fermeture.
 */
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { MenuAvatar } from '@/features/compte/components/MenuAvatar'
import { ModifierProfil } from '@/features/compte/components/ModifierProfil'
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

// /<onglet>/explorateur/<id>/modifier — seulement le sien : l'adresse d'un autre ramène à son
// profil. Enregistrer revient au profil par le retour (ou le remplace, ouvert à froid).
export function RouteModifier() {
  const { tab = 'accueil', id = '' } = useParams()
  const moi = useMonIdentifiant()
  const location = useLocation()
  const navigate = useNavigate()
  const profil = `/${tab}/explorateur/${id}`

  if (moi === null) return null
  if (id !== moi) return <Navigate to={profil} replace />

  function termine() {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(profil, { replace: true })
  }

  return (
    <DetailPane title="Modifier mon profil">
      <ModifierProfil onTermine={termine} />
    </DetailPane>
  )
}
