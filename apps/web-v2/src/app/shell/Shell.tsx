/**
 * QUOI     — la coquille : logotype, « Ajouter » et la cloche, barre d'onglets, les quatre écrans
 *            racines, le détail.
 * POURQUOI — les quatre écrans restent MONTÉS et seul l'actif est visible : leur état et leur
 *            défilement survivent au changement d'onglet sans aucun code de restauration. Le
 *            Compte est un onglet (Uriel, 28/09) : l'en-tête garde « Ajouter » et la cloche.
 * ATTENTION — chaque écran racine est son propre conteneur de défilement (voir le CSS) ; c'est
 *            lui qu'on remonte au double toucher, pas la fenêtre.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AccueilScreen } from '@/features/accueil/components/AccueilScreen'
import { CarteScreen } from '@/features/carte/components/CarteScreen'
import { CompteScreen } from '@/features/compte/components/CompteScreen'
import { MessagesScreen } from '@/features/messages/components/MessagesScreen'
import ajouter from '@/assets/ui/ajouter.svg'
import cloche from '@/assets/ui/cloche.svg'
import embleme from '@/assets/ui/embleme.png'
import logotype from '@/assets/ui/logotype.png'
import { Text } from '@/shared/ui/Text'
import { V1_URL } from '../access/AccessGate'
import { tabOf, TABS, type TabId } from '../navigation/tabs'
import { TabBar } from './TabBar'
import styles from './Shell.module.css'

const SCREENS: Record<TabId, () => ReactNode> = {
  accueil: AccueilScreen,
  carte: CarteScreen,
  messages: MessagesScreen,
  compte: CompteScreen,
}

// Ce qui s'ouvre par-dessus l'onglet en FEUILLE (depuis le bas), et non en détail : sur desktop,
// une feuille n'ouvre pas le panneau latéral.
const FEUILLES = new Set(['ajouter'])

export function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = tabOf(pathname)
  // Par-dessus l'onglet : un segment après lui (/carte/ajouter, /carte/explorateur/…). Segments
  // vides ignorés (/carte/).
  const segments = pathname.split('/').filter(Boolean)
  const overlayOpen = segments.length > 1
  const feuilleOpen = FEUILLES.has(segments[1] ?? '')
  const detailOpen = overlayOpen && !feuilleOpen
  const scrollers = useRef<Partial<Record<TabId, HTMLElement | null>>>({})
  const boutonAjouter = useRef<HTMLButtonElement>(null)
  const overlayWasOpen = useRef(false)

  // À la fermeture d'un détail ou d'une feuille, le focus revient à « Ajouter » (clavier,
  // lecteur d'écran) au lieu de se perdre en haut de la page.
  useEffect(() => {
    if (overlayWasOpen.current && !overlayOpen) boutonAjouter.current?.focus()
    overlayWasOpen.current = overlayOpen
  }, [overlayOpen])

  function scrollTop(tab: TabId) {
    scrollers.current[tab]?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Ce qui est déjà ouvert ne s'empile pas une seconde fois dans l'historique.
  function ouvrir(segment: string) {
    if (active && segments[1] !== segment) void navigate(`/${active}/${segment}`)
  }

  return (
    <div className={styles.shell} data-detail={detailOpen ? 'open' : undefined}>
      {/* Le logotype en entier sur mobile ; l'emblème seul dans la barre verticale du desktop. */}
      <img className={styles.logo} src={logotype} alt="Runes de Chêne" />
      <img className={styles.embleme} src={embleme} alt="Runes de Chêne" />
      {/* Pendant la construction (spec socle §6) : la sortie vers la V1 reste toujours visible,
          y compris dans la V2 installée en application, qui n'a pas de barre d'adresse. */}
      <a className={styles.retourV1} href={V1_URL}>
        <Text variant="libelle">Revenir V1</Text>
      </a>
      <div className={styles.actions}>
        <button
          ref={boutonAjouter}
          type="button"
          className={styles.action}
          aria-label="Ajouter"
          onClick={() => {
            ouvrir('ajouter')
          }}
        >
          <img src={ajouter} alt="" />
        </button>
        <button
          type="button"
          className={styles.action}
          aria-label="Notifications"
          onClick={() => {
            ouvrir('notifications')
          }}
        >
          <img src={cloche} alt="" />
        </button>
      </div>
      <main className={styles.main}>
        {TABS.map(({ id, label }) => {
          const Screen = SCREENS[id]
          return (
            <section
              key={id}
              aria-label={label}
              hidden={id !== active}
              className={styles.screen}
              ref={(element) => {
                scrollers.current[id] = element
              }}
            >
              <Screen />
            </section>
          )
        })}
      </main>
      <Outlet />
      <TabBar onScrollTop={scrollTop} />
    </div>
  )
}
