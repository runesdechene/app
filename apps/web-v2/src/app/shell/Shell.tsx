/**
 * QUOI     — la coquille : logotype, « Ajouter » et la cloche, barre d'onglets, les quatre écrans
 *            racines, le détail, et sur desktop le tiroir et son bouton pour le replier.
 * POURQUOI — les quatre écrans restent MONTÉS : leur état et leur défilement survivent au
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
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { disposition } from '../navigation/disposition'
import { TABS, type TabId } from '../navigation/tabs'
import { TabBar } from './TabBar'
import styles from './Shell.module.css'

const SCREENS: Record<TabId, () => ReactNode> = {
  accueil: AccueilScreen,
  carte: CarteScreen,
  messages: MessagesScreen,
  compte: CompteScreen,
}

export function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { actif: active, detail, feuille, tiroir } = disposition(pathname)
  const overlayOpen = detail || feuille
  // L'adresse sur laquelle on a replié le tiroir : ailleurs, il est déplié.
  const [replieSur, setReplieSur] = useState<string | null>(null)
  const tiroirVisible = tiroir && replieSur !== pathname
  // Le dernier onglet ouvert dans le tiroir : « déplier » depuis la Carte y ramène.
  const [dernierTiroir, setDernierTiroir] = useState<TabId>('accueil')
  if (active !== null && active !== 'carte' && active !== dernierTiroir) setDernierTiroir(active)
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
    const adresse = `/${active ?? 'carte'}/${segment}`
    if (pathname !== adresse) void navigate(adresse)
  }

  return (
    <div className={styles.shell} data-tiroir={tiroirVisible ? 'open' : undefined}>
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
        {tiroirVisible ? '«' : '»'}
      </button>
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
              <Screen />
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
  )
}
