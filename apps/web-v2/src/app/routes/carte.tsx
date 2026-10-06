/**
 * QUOI     — les adresses de l'en-tête, branchées sur la coquille : la feuille « Ajouter », le
 *            parcours « Ajouter un lieu », les notifications et les nouveautés de l'app.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail et la fonction de fermeture.
 * ATTENTION — la fiche d'un lieu vit dans lieu.tsx.
 */
import { lazy, Suspense, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router'
import { AjouterFeuille } from '@/features/ajout/components/AjouterFeuille'
import { Notifications } from '@/features/notifications/components/Notifications'
import { Nouveautes } from '@/features/notifications/components/Nouveautes'
import { RacineDesFeuilles } from '@/shared/ui/racineDesFeuilles'
import { useFermerDetail } from '../navigation/useFermerDetail'
import { DetailPane } from '../shell/DetailPane'

// Le parcours d'ajout porte une carte (MapLibre) : il se charge à l'ouverture, pas avant.
const ParcoursAjout = lazy(() =>
  import('@/features/ajout/components/ParcoursAjout').then((m) => ({ default: m.ParcoursAjout })),
)

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
    <Suspense fallback={null}>
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
    </Suspense>
  )
}

const PoserPin = lazy(() =>
  import('@/features/pin/components/PoserPin').then((m) => ({ default: m.PoserPin })),
)

// /<onglet>/ajouter/pin — poser un pin GPS (maquettes « Pin GPS — 1 à 2b »). Plein écran, posé dans
// la racine des feuilles comme le parcours d'ajout.
export function RoutePoserPin() {
  const racine = useContext(RacineDesFeuilles)
  const fermer = useFermerDetail()
  const ecran = (
    <Suspense fallback={null}>
      <PoserPin onFermer={fermer} />
    </Suspense>
  )
  return racine ? createPortal(ecran, racine) : ecran
}

// /<onglet>/notifications
export function RouteNotifications() {
  return (
    <DetailPane title="Notifications">
      <Notifications />
    </DetailPane>
  )
}

// /<onglet>/nouveautes — les mises à jour de l'app, ouvertes depuis la cloche
export function RouteNouveautes() {
  return (
    <DetailPane title="Nouveautés">
      <Nouveautes />
    </DetailPane>
  )
}
