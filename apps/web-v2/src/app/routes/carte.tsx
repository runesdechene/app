/**
 * QUOI     — les adresses de l'en-tête, branchées sur la coquille : la feuille « Ajouter », le
 *            parcours « Ajouter un lieu » et les notifications.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail et la fonction de fermeture.
 * ATTENTION — la fiche d'un lieu vit dans lieu.tsx.
 */
import { useLocation, useNavigate, useParams } from 'react-router'
import { AjouterFeuille } from '@/features/ajout/components/AjouterFeuille'
import { ParcoursAjout } from '@/features/ajout/components/ParcoursAjout'
import { Notifications } from '@/features/notifications/components/Notifications'
import { useFermerDetail } from '../navigation/useFermerDetail'
import { DetailPane } from '../shell/DetailPane'

// /<onglet>/ajouter — la feuille du « + » (maquette 201:216)
export function RouteAjouter() {
  return <AjouterFeuille onFermer={useFermerDetail()} />
}

// /<onglet>/ajouter/lieu/<étape> — le parcours « Ajouter un lieu ». Quitter revient d'une entrée
// (la feuille a été remplacée par le parcours : on retrouve l'onglet) ; ouvert directement par son
// adresse, il n'y a rien derrière : on remplace par l'onglet. La fiche du lieu posé remplace le
// parcours : le retour depuis la fiche ramène à l'onglet, pas dans un parcours fini.
export function RouteAjouterLieu() {
  const { tab = 'carte', etape } = useParams()
  const { key } = useLocation()
  const navigate = useNavigate()
  return (
    <ParcoursAjout
      etape={etape}
      onQuitter={() => {
        if (key === 'default') void navigate(`/${tab}`, { replace: true })
        else void navigate(-1)
      }}
      onVoirLieu={(id) => {
        void navigate(`/${tab}/lieu/${id}`, { replace: true })
      }}
    />
  )
}

// /<onglet>/notifications
export function RouteNotifications() {
  return (
    <DetailPane title="Notifications">
      <Notifications />
    </DetailPane>
  )
}
