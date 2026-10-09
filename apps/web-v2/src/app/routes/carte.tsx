/**
 * QUOI     — les adresses de l'en-tête, branchées sur la coquille : la feuille « Ajouter », le
 *            parcours « Ajouter un lieu », le pin GPS (poser, sa petite carte, le compléter), les
 *            notifications, les nouveautés de l'app et tous les titres.
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que ses écrans
 *            reçoivent le cadre de détail et la fonction de fermeture.
 * ATTENTION — la fiche d'un lieu vit dans lieu.tsx.
 */
import { lazy, Suspense, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { AjouterFeuille } from '@/features/ajout/components/AjouterFeuille'
import { DepuisUnPin } from '@/features/ajout/components/DepuisUnPin'
import { CestLunDeCeuxLa } from '@/features/pin/components/CestLunDeCeuxLa'
import { FichePin } from '@/features/pin/components/FichePin'
import { TesPins } from '@/features/pin/components/TesPins'
import {
  useEnvoyerALOuverture,
  useMesPins,
  useMesPinsCharges,
  type PinAffiche,
} from '@/features/pin/hooks/usePins'
import { Notifications } from '@/features/notifications/components/Notifications'
import { Nouveautes } from '@/features/notifications/components/Nouveautes'
import { PageTitres } from '@/features/titres/components/PageTitres'
import { PageCulture } from '@/features/enigmes/components/PageCulture'
import { PageEnigmes } from '@/features/enigmes/components/PageEnigmes'
import { useMaCulture } from '@/features/enigmes/hooks/useMesEnigmes'
import { RacineDesFeuilles } from '@/shared/ui/racineDesFeuilles'
import { useFermerDetail } from '../navigation/useFermerDetail'
import { DetailPane } from '../shell/DetailPane'

// Le parcours d'ajout porte une carte (MapLibre) : il se charge à l'ouverture, pas avant.
const ParcoursAjout = lazy(() =>
  import('@/features/ajout/components/ParcoursAjout').then((m) => ({ default: m.ParcoursAjout })),
)

// /<onglet>/ajouter — la feuille du « + » (maquette 201:216) ; « Tes pins » en tête (zone pin),
// posé ici : la zone ajout ne connaît pas la zone pin.
export function RouteAjouter() {
  const { tab = 'carte' } = useParams()
  const navigate = useNavigate()
  const pins = useMesPins()
  useEnvoyerALOuverture() // spec : les pins en attente partent aussi à l'ouverture du « + »
  return (
    <AjouterFeuille
      onFermer={useFermerDetail()}
      enTete={
        pins.length > 0 ? (
          <TesPins
            pins={pins}
            onOuvrir={(id) => {
              void navigate(`/${tab}/ajouter/pin/${id}`, { replace: true })
            }}
          />
        ) : undefined
      }
    />
  )
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

// /<onglet>/ajouter/pin/:id — la petite carte d'un pin (maquette « Pin GPS — 4 »). Un pin inconnu
// à l'arrivée (lien périmé) renvoie à la feuille du « + » ; un pin vu puis supprimé, non : la
// fiche se ferme d'elle-même.
export function RouteFichePin() {
  const { tab = 'carte', id = '' } = useParams()
  const navigate = useNavigate()
  const fermer = useFermerDetail()
  const pins = useMesPinsCharges()
  const [vu, setVu] = useState(false)
  const present = pins?.some((p) => p.id === id) ?? false
  if (present && !vu) setVu(true)
  if (pins && !present && !vu) return <Navigate to={`/${tab}/ajouter`} replace />
  return (
    <FichePin
      id={id}
      onFermer={fermer}
      onCompleter={() => {
        void navigate(`/${tab}/ajouter/pin/${id}/completer`, { replace: true })
      }}
      onVoirSurLaCarte={() => {
        void navigate(`/carte?pin=${id}`, { replace: true })
      }}
    />
  )
}

// /<onglet>/ajouter/pin/:id/completer — « C'est l'un de ceux-là ? » (maquette « Pin GPS — 5 »),
// puis le parcours d'ajout sur un brouillon né du pin (« Remplacer ton brouillon en cours ? »
// d'abord, si un autre attend). Le pin vu à l'arrivée est gardé : « C'est lui » le ferme (la liste
// relue ne l'a plus), et l'écran doit pouvoir finir de le dire (« Pin fermé, sans visite »).
export function RouteCompleterPin() {
  const { tab = 'carte', id = '' } = useParams()
  const navigate = useNavigate()
  const fermer = useFermerDetail()
  const pins = useMesPinsCharges()
  const [vu, setVu] = useState<PinAffiche | null>(null)
  const trouve = pins?.find((p) => p.id === id)
  if (trouve && vu?.id !== trouve.id) setVu(trouve)
  const pin = trouve ?? (vu?.id === id ? vu : undefined)
  const [autre, setAutre] = useState(false)
  // Stable : la feuille l'appelle d'elle-même quand aucun lieu n'est proche.
  const versAjout = useCallback(() => {
    setAutre(true)
  }, [])
  if (!pins) return null // la liste arrive
  // Inconnu, ou encore dans le téléphone (le serveur ne le connaît pas) : retour au « + ».
  if (!pin || pin.enAttente) return <Navigate to={`/${tab}/ajouter`} replace />
  if (autre) {
    return (
      <DepuisUnPin
        pin={pin}
        onOuvrir={(etape) => {
          void navigate(`/${tab}/ajouter/lieu/${etape}`, { replace: true })
        }}
      />
    )
  }
  return (
    <CestLunDeCeuxLa
      pin={pin.id}
      poseLe={pin.poseLe}
      // Sans visite (pin périmé), la feuille l'a déjà dit avant d'offrir « Voir le lieu ».
      onVisite={(lieu) => {
        void navigate(`/${tab}/lieu/${lieu}`, { replace: true })
      }}
      onAutre={versAjout}
      onFermer={fermer}
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

// /<onglet>/nouveautes — les mises à jour de l'app, ouvertes depuis la cloche
export function RouteNouveautes() {
  return (
    <DetailPane title="Nouveautés">
      <Nouveautes />
    </DetailPane>
  )
}

// /<onglet>/titres — tous les titres, ouverts depuis la coupe (maquette 112:107)
export function RouteTitres() {
  return (
    <DetailPane title="Tous les titres">
      <PageTitres />
    </DetailPane>
  )
}

// « Les énigmes » (Uriel, 07/10) : un panneau sur l'onglet courant, comme « Tous les titres » ;
// une culture s'ouvre en dessous (/…/enigmes/<culture>).
export function RouteEnigmes() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <DetailPane title="Les énigmes">
      <PageEnigmes
        onOuvrirCulture={(id) => {
          void navigate(`${pathname}/${id}`)
        }}
      />
    </DetailPane>
  )
}

export function RouteEnigmesCulture() {
  const { culture = '' } = useParams()
  const { maCulture } = useMaCulture(culture)
  return (
    <DetailPane title={maCulture?.culture.nom ?? 'Les énigmes'}>
      <PageCulture id={culture} />
    </DetailPane>
  )
}
