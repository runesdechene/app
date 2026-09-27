/**
 * QUOI     — la coquille : logotype, avatar, barre d'onglets, les cinq écrans racines, le détail.
 * POURQUOI — les cinq écrans restent MONTÉS et seul l'actif est visible : leur état et leur
 *            défilement survivent au changement d'onglet sans aucun code de restauration.
 * ATTENTION — chaque écran racine est son propre conteneur de défilement (voir le CSS) ; c'est
 *            lui qu'on remonte au double toucher, pas la fenêtre.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AccueilScreen } from '@/features/accueil/components/AccueilScreen'
import { CampementScreen } from '@/features/campement/components/CampementScreen'
import { CarteScreen } from '@/features/carte/components/CarteScreen'
import { CodexScreen } from '@/features/codex/components/CodexScreen'
import { useExplorateur } from '@/features/compte/hooks/useExplorateur'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { MessagesScreen } from '@/features/messages/components/MessagesScreen'
import logotype from '@/assets/ui/logotype.png'
import { Avatar } from '@/shared/ui/Avatar'
import { Text } from '@/shared/ui/Text'
import { V1_URL } from '../access/AccessGate'
import { tabOf, TABS, type TabId } from '../navigation/tabs'
import { TabBar } from './TabBar'
import styles from './Shell.module.css'

const SCREENS: Record<TabId, () => ReactNode> = {
  accueil: AccueilScreen,
  carte: CarteScreen,
  messages: MessagesScreen,
  codex: CodexScreen,
  campement: CampementScreen,
}

export function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = tabOf(pathname)
  // Par-dessus l'onglet : un segment après lui (/carte/menu, /carte/explorateur/…). Segments
  // vides ignorés (/carte/). Le menu est une feuille : il n'ouvre pas le panneau desktop.
  const segments = pathname.split('/').filter(Boolean)
  const overlayOpen = segments.length > 1
  const menuOpen = segments[1] === 'menu'
  const detailOpen = overlayOpen && !menuOpen
  const moi = useMonIdentifiant()
  const { profil } = useExplorateur(moi)
  const scrollers = useRef<Partial<Record<TabId, HTMLElement | null>>>({})
  const avatar = useRef<HTMLButtonElement>(null)
  const overlayWasOpen = useRef(false)

  // À la fermeture d'un détail ou du menu, le focus revient à l'avatar (clavier, lecteur
  // d'écran) au lieu de se perdre en haut de la page.
  useEffect(() => {
    if (overlayWasOpen.current && !overlayOpen) avatar.current?.focus()
    overlayWasOpen.current = overlayOpen
  }, [overlayOpen])

  function scrollTop(tab: TabId) {
    scrollers.current[tab]?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={styles.shell} data-detail={detailOpen ? 'open' : undefined}>
      <img className={styles.logo} src={logotype} alt="Runes de Chêne" />
      {/* Pendant la construction (spec socle §6) : la sortie vers la V1 reste toujours visible,
          y compris dans la V2 installée en application, qui n'a pas de barre d'adresse. */}
      <a className={styles.retourV1} href={V1_URL}>
        <Text variant="libelle">Revenir à la V1</Text>
      </a>
      <button
        ref={avatar}
        type="button"
        className={styles.avatar}
        aria-label="Mon compte"
        onClick={() => {
          // Le menu déjà ouvert ne s'empile pas une seconde fois dans l'historique.
          if (active && !menuOpen) void navigate(`/${active}/menu`)
        }}
      >
        <Avatar url={profil?.avatarUrl ?? null} nom={profil?.nom ?? ''} taille="petit" />
      </button>
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
