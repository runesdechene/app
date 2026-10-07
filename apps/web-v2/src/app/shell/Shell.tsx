/**
 * QUOI     — la coquille : logotype, la cloche (et sur PC les énigmes, la coupe, l'engrenage, la
 *            sortie), barre d'onglets, les cinq écrans
 *            racines, le détail, et sur desktop le tiroir et son bouton pour le replier.
 * POURQUOI — les cinq écrans restent MONTÉS : leur état et leur défilement survivent au
 *            changement d'onglet sans aucun code de restauration. Sur mobile, seul l'actif est
 *            visible. Sur desktop, la carte reste toujours là et l'onglet actif (ou un détail)
 *            s'ouvre dans un tiroir à côté (spec socle §4bis, Uriel 28/09). Le JavaScript dit
 *            ce qui est ouvert (`disposition`) ; le CSS place selon la largeur.
 *            Le tiroir se replie sans jamais se fermer (comme la V1) : c'est un réglage de la
 *            vue, pas une adresse. Replié sur une adresse, il se rouvre dès qu'on en change ou
 *            qu'on touche un onglet.
 * ATTENTION — chaque écran racine est son propre conteneur de défilement (voir le CSS) ; c'est
 *            lui qu'on remonte au double toucher, pas la fenêtre.
 */
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AccueilScreen } from '@/features/accueil/components/AccueilScreen'
import { useExplorateur } from '@/features/compte/hooks/useExplorateur'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { JaugeEnergie } from '@/features/energie/components/JaugeEnergie'
import { CompteScreen } from '@/features/compte/components/CompteScreen'
import { MessagesScreen } from '@/features/messages/components/MessagesScreen'
import { PageCompagnies } from '@/features/compagnies/components/PageCompagnies'
import { seDeconnecter } from '@/features/compte/api/session'
import { InvitationPosition } from '@/features/carte/components/InvitationPosition'
import { usePreparerLaCarte } from '@/features/carte/hooks/usePreparerLaCarte'
import { useSignalerPresence } from '@/features/lieu/hooks/useSignalerPresence'
import { useEnvoyerPins, useMesPinsCharges } from '@/features/pin/hooks/usePins'
import { useNonLues } from '@/features/notifications/hooks/useNotifications'
import cloche from '@/assets/ui/cloche.svg'
import coupe from '@/assets/ui/coupe.svg'
import embleme from '@/assets/ui/embleme.png'
import engrenage from '@/assets/ui/engrenage.svg'
import enigmes from '@/assets/ui/menu-enigmes.svg'
import logotype from '@/assets/ui/logotype.webp'
import replier from '@/assets/ui/replier.svg'
import sortie from '@/assets/ui/sortie.svg'
import { RacineDesFeuilles } from '@/shared/ui/racineDesFeuilles'
import { Pastille } from '@/shared/ui/Pastille'
import { VERSION } from '@/shared/lib/version'
import { useSurOrdinateur } from '@/shared/hooks/useSurOrdinateur'
import { disposition } from '../navigation/disposition'
import { useOuvrir } from '../navigation/useOuvrir'
import { TABS, type TabId } from '../navigation/tabs'
import { TabBar } from './TabBar'
import styles from './Shell.module.css'

const SCREENS: Record<TabId, () => ReactNode> = {
  accueil: AccueilScreen,
  carte: CarteDeLaCoquille,
  messages: MessagesScreen,
  compagnies: PageCompagnies,
  compte: CompteScreen,
}

// La carte et son moteur (MapLibre, le plus gros morceau de l'app) ne se chargent qu'à l'ouverture
// de la carte : le premier écran répond sans attendre.
const CarteScreen = lazy(() =>
  import('@/features/carte/components/CarteScreen').then((m) => ({ default: m.CarteScreen })),
)

// La carte de la coquille : la jauge d'énergie sous la recherche, soi (portrait, nom, premier
// titre porté, comme les autres Explorateurs), et le « + »
// qui ouvre l'ajout (Uriel, 05/10 : le seul « + », sur la carte, téléphone comme PC).
function CarteDeLaCoquille() {
  const { profil } = useExplorateur(useMonIdentifiant())
  const ouvrir = useOuvrir()
  const navigate = useNavigate()
  // Mes pins sur la carte (seulement ceux que le serveur connaît) ; « Voir sur la carte » arrive
  // par /carte?pin=<id> : la carte s'y centre, puis la demande est retirée.
  const charges = useMesPinsCharges()
  const pins = useMemo(() => (charges ?? []).filter((p) => !p.enAttente), [charges])
  const mesPins = useMemo(() => pins.map(({ id, point, jours }) => ({ id, point, jours })), [pins])
  const [recherche, setRecherche] = useSearchParams()
  const centrerSur = pins.find((p) => p.id === recherche.get('pin'))?.point
  return (
    <Suspense fallback={null}>
      <CarteScreen
        mesPins={mesPins}
        onToucherPin={(id) => {
          void navigate(`/carte/ajouter/pin/${id}`)
        }}
        centrerSur={centrerSur}
        onCentre={() => {
          setRecherche(
            (p) => {
              p.delete('pin')
              return p
            },
            { replace: true },
          )
        }}
        sousLaRecherche={<JaugeEnergie />}
        soi={
          profil
            ? { nom: profil.nom, avatar: profil.avatarUrl, titre: profil.titres[0]?.nom ?? null }
            : null
        }
        onAjouter={() => {
          ouvrir('ajouter')
        }}
      />
    </Suspense>
  )
}

export function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Tant que l'app est ouverte (position autorisée) : sur la carte, et proposé comme compagnon.
  useSignalerPresence()
  useEnvoyerPins() // les pins posés sans réseau partent dès qu'il revient
  // Au téléphone, l'app s'ouvre sur l'Accueil : la carte se prépare derrière.
  usePreparerLaCarte()
  const nonLues = useNonLues()
  const { actif: active, detail, feuille, tiroir } = disposition(pathname)
  const overlayOpen = detail || feuille
  // L'adresse sur laquelle on a replié le tiroir : ailleurs, il est déplié.
  const [replieSur, setReplieSur] = useState<string | null>(null)
  const tiroirVisible = tiroir && replieSur !== pathname
  // Le dernier onglet ouvert dans le tiroir : « déplier » depuis la Carte y ramène.
  const [dernierTiroir, setDernierTiroir] = useState<TabId>('accueil')
  // La coquille elle-même : toutes les feuilles s'y posent, leur voile couvre toute l'app.
  const [racine, setRacine] = useState<HTMLDivElement | null>(null)
  if (active !== null && active !== 'carte' && active !== dernierTiroir) setDernierTiroir(active)
  // Un onglet ne démarre qu'à sa première visite, puis reste monté (il garde sa place) : à
  // l'ouverture, seul l'écran regardé charge ses images et ses données. Sur ordinateur, la carte
  // est toujours visible derrière le tiroir : elle démarre d'emblée.
  const [visites, setVisites] = useState<ReadonlySet<TabId>>(() => new Set(active ? [active] : []))
  if (active !== null && !visites.has(active)) setVisites(new Set([...visites, active]))
  const surOrdinateur = useSurOrdinateur()
  const monte = (id: TabId) => visites.has(id) || (id === 'carte' && surOrdinateur)
  const scrollers = useRef<Partial<Record<TabId, HTMLElement | null>>>({})
  const boutonNotifications = useRef<HTMLButtonElement>(null)
  const overlayWasOpen = useRef(false)
  const ouvrePar = useRef<HTMLElement | null>(null)
  const ouvrir = useOuvrir()

  // Le bouton qui ouvre un détail ou une feuille (le « + » de la carte, la cloche…) : relevé
  // avant que la feuille ne prenne le focus — un effet de mise en page passe avant les siens.
  useLayoutEffect(() => {
    if (!overlayWasOpen.current && overlayOpen) {
      ouvrePar.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
  }, [overlayOpen])

  // À la fermeture, le focus lui revient — à la cloche s'il n'est plus là — au lieu de se perdre
  // en haut de la page (clavier, lecteur d'écran).
  useEffect(() => {
    if (overlayWasOpen.current && !overlayOpen) {
      const retour = ouvrePar.current?.isConnected ? ouvrePar.current : boutonNotifications.current
      retour?.focus()
    }
    overlayWasOpen.current = overlayOpen
  }, [overlayOpen])

  function scrollTop(tab: TabId) {
    scrollers.current[tab]?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <RacineDesFeuilles value={racine}>
      <div
        ref={setRacine}
        className={styles.shell}
        data-tiroir={tiroirVisible ? 'open' : undefined}
      >
        {/* Desktop seulement (le CSS le cache sur mobile), comme la V1. */}
        <button
          type="button"
          className={styles.replier}
          aria-label={tiroirVisible ? 'Replier le panneau' : 'Déplier le panneau'}
          aria-expanded={tiroirVisible}
          onClick={() => {
            if (tiroirVisible) setReplieSur(pathname)
            else if (tiroir) setReplieSur(null)
            else void navigate(`/${dernierTiroir}`)
          }}
        >
          <img src={replier} alt="" />
        </button>
        {/* Le logotype en entier sur mobile ; l'emblème seul dans la barre verticale du desktop. */}
        <img className={styles.logo} src={logotype} alt="Runes de Chêne" />
        <img className={styles.embleme} src={embleme} alt="Runes de Chêne" />
        {/* Uriel, 01/10 : le numéro qui dit que le dernier déploiement est arrivé. */}
        <span className={styles.version}>{VERSION}</span>
        <div className={styles.actions}>
          {/* Sur PC, les énigmes et les titres au-dessus de la cloche, les préférences et la sortie
              dessous (Uriel, 07/10) ; sur téléphone, ils vivent dans le menu du profil. */}
          {surOrdinateur && (
            <>
              <button
                type="button"
                className={styles.action}
                aria-label="Les énigmes"
                onClick={() => {
                  ouvrir('enigmes')
                }}
              >
                <img src={enigmes} alt="" />
              </button>
              <button
                type="button"
                className={styles.action}
                aria-label="Tous les titres"
                onClick={() => {
                  ouvrir('titres')
                }}
              >
                <img src={coupe} alt="" />
              </button>
            </>
          )}
          <button
            ref={boutonNotifications}
            type="button"
            className={styles.action}
            aria-label="Notifications"
            onClick={() => {
              ouvrir('notifications')
            }}
          >
            <img src={cloche} alt="" />
            <span className={styles.nonLues}>
              <Pastille count={nonLues} />
            </span>
          </button>
          {surOrdinateur && (
            <>
              <button
                type="button"
                className={styles.action}
                aria-label="Préférences"
                onClick={() => {
                  ouvrir('preferences')
                }}
              >
                <img src={engrenage} alt="" />
              </button>
              <button
                type="button"
                className={styles.action}
                aria-label="Se déconnecter"
                onClick={() => {
                  // La garde d'accès voit la session tomber et renvoie vers la V1 ; un échec laisse
                  // simplement la session ouverte.
                  void seDeconnecter().catch(() => undefined)
                }}
              >
                <img src={sortie} alt="" />
              </button>
            </>
          )}
        </div>
        <main className={styles.main}>
          {TABS.map(({ id, label }) => {
            const Screen = SCREENS[id]
            return (
              // La carte n'est jamais cachée : sur desktop elle reste derrière le tiroir ; sur
              // mobile, le CSS la masque quand un autre onglet est actif.
              <section
                key={id}
                aria-label={label}
                hidden={id !== active && id !== 'carte'}
                data-ecran={id}
                data-derriere={id === 'carte' && active !== 'carte' ? '' : undefined}
                className={styles.screen}
                ref={(element) => {
                  scrollers.current[id] = element
                }}
              >
                {monte(id) && <Screen />}
              </section>
            )
          })}
        </main>
        <Outlet />
        {/* Une seule fois, si la position n'a jamais été demandée : sans elle, invisible. */}
        <InvitationPosition />
        <TabBar
          onScrollTop={scrollTop}
          onToucher={() => {
            setReplieSur(null)
          }}
        />
      </div>
    </RacineDesFeuilles>
  )
}
