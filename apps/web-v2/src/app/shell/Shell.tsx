/**
 * QUOI     — la coquille : logotype, la cloche, barre d'onglets, les cinq écrans
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
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AccueilScreen } from '@/features/accueil/components/AccueilScreen'
import { useExplorateur } from '@/features/compte/hooks/useExplorateur'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { JaugeEnergie } from '@/features/energie/components/JaugeEnergie'
import { CompteScreen } from '@/features/compte/components/CompteScreen'
import { MessagesScreen } from '@/features/messages/components/MessagesScreen'
import { PageCompagnies } from '@/features/compagnies/components/PageCompagnies'
import { seDeconnecter } from '@/features/compte/api/session'
import { usePreparerLaCarte } from '@/features/carte/hooks/usePreparerLaCarte'
import { useSignalerPresence } from '@/features/lieu/hooks/useSignalerPresence'
import { useNonLues } from '@/features/notifications/hooks/useNotifications'
import cloche from '@/assets/ui/cloche.svg'
import embleme from '@/assets/ui/embleme.png'
import engrenage from '@/assets/ui/engrenage.svg'
import logotype from '@/assets/ui/logotype.webp'
import replier from '@/assets/ui/replier.svg'
import sortie from '@/assets/ui/sortie.svg'
import { RacineDesFeuilles } from '@/shared/ui/racineDesFeuilles'
import { Pastille } from '@/shared/ui/Pastille'
import { Text } from '@/shared/ui/Text'
import { choisirLaV1 } from '@/shared/lib/ancienneExplore'
import { VERSION } from '@/shared/lib/version'
import { useSurOrdinateur } from '@/shared/hooks/useSurOrdinateur'
import { V1_URL } from '../access/AccessGate'
import { disposition } from '../navigation/disposition'
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

// Ouvrir un panneau (« ajouter », « notifications »…) par-dessus l'onglet courant. Ce qui est
// déjà ouvert ne s'empile pas une seconde fois dans l'historique. Un panneau prend la place du
// détail ouvert (un lieu…) au lieu de s'empiler dessus : le fermer ramène à l'onglet, sans
// rouvrir le détail d'avant (Uriel, 30/09).
function useOuvrir() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { actif } = disposition(pathname)
  return (segment: string) => {
    const racine = `/${actif ?? 'carte'}`
    const adresse = `${racine}/${segment}`
    if (pathname !== adresse) void navigate(adresse, { replace: pathname !== racine })
  }
}

// La carte de la coquille : la jauge d'énergie sous la recherche, son propre portrait, et le « + »
// qui ouvre l'ajout (Uriel, 05/10 : le seul « + », sur la carte, téléphone comme PC).
function CarteDeLaCoquille() {
  const { profil } = useExplorateur(useMonIdentifiant())
  const ouvrir = useOuvrir()
  return (
    <Suspense fallback={null}>
      <CarteScreen
        sousLaRecherche={<JaugeEnergie />}
        monAvatar={profil?.avatarUrl ?? null}
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
  // Tant que l'app est ouverte (position déjà autorisée) : être proposé comme compagnon.
  useSignalerPresence()
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
        {/* Pendant la construction (spec socle §6) : la sortie vers la V1 reste toujours visible,
          y compris dans la V2 installée en application, qui n'a pas de barre d'adresse. */}
        <a className={styles.retourV1} href={V1_URL} onClick={choisirLaV1}>
          <Text variant="libelle">Revenir V1</Text>
        </a>
        {/* Uriel, 01/10 : le numéro qui dit que le dernier déploiement est arrivé. */}
        <span className={styles.version}>{VERSION}</span>
        <div className={styles.actions}>
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
          {/* Sur PC seulement (le CSS les cache sur mobile, où elles vivent sur la page Compte). */}
          <button
            type="button"
            className={[styles.action, styles.pc].join(' ')}
            aria-label="Préférences"
            onClick={() => {
              ouvrir('preferences')
            }}
          >
            <img src={engrenage} alt="" />
          </button>
          <button
            type="button"
            className={[styles.action, styles.pc].join(' ')}
            aria-label="Se déconnecter"
            onClick={() => {
              // La garde d'accès voit la session tomber et renvoie vers la V1 ; un échec laisse
              // simplement la session ouverte (la page Compte le dit sur mobile).
              void seDeconnecter().catch(() => undefined)
            }}
          >
            <img src={sortie} alt="" />
          </button>
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
