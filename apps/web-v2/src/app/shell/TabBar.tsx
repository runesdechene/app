/**
 * QUOI     — la barre des quatre onglets : icône gravée + libellé, lisière de forêt au-dessus ;
 *            l'onglet Compte montre l'avatar de l'Explorateur à la place d'une icône.
 * POURQUOI — un toucher est traduit par resolveTabPress (règles mobiles) puis appliqué ici.
 *            Sur PC, un fond clair glisse jusqu'à l'onglet actif : un seul élément, le curseur,
 *            déplacé en CSS selon son rang (`--rang`), comme la brique Segments.
 * ATTENTION — ce sont des <button>, pas des <a> : un onglet n'ouvre pas toujours son adresse
 *            (mémoire, double toucher). aria-current marque l'onglet actif pour les lecteurs
 *            d'écran. Les icônes sont décoratives (aria-hidden) : le libellé porte le nom.
 *            L'onglet Messages porte la pastille des murmures non lus, posée sur son icône.
 */
import { useLocation, useNavigate } from 'react-router'
import { useExplorateur } from '@/features/compte/hooks/useExplorateur'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { useNonLus } from '@/features/messages/hooks/useMurmures'
import accueilIcon from '@/assets/ui/onglet-accueil.png'
import carteIcon from '@/assets/ui/onglet-carte.png'
import messagesIcon from '@/assets/ui/onglet-messages.png'
import { Avatar } from '@/shared/ui/Avatar'
import { Pastille } from '@/shared/ui/Pastille'
import { Text } from '@/shared/ui/Text'
import { resolveTabPress, tabOf, TABS, type TabId } from '../navigation/tabs'
import { useTabMemory } from '../navigation/useTabMemory'
import styles from './TabBar.module.css'

// Sur PC, la barre n'a pas d'onglet Carte (la carte y est toujours là) : le curseur se range
// parmi les trois autres, et disparaît quand la Carte est active.
const ONGLETS_PC = TABS.filter((tab) => tab.id !== 'carte')

const ICONS: Record<Exclude<TabId, 'compte'>, string> = {
  accueil: accueilIcon,
  carte: carteIcon,
  messages: messagesIcon,
}

export function TabBar({
  onScrollTop,
  onToucher,
}: {
  onScrollTop: (tab: TabId) => void
  onToucher: () => void
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const memory = useTabMemory()
  const active = tabOf(pathname)
  const { profil } = useExplorateur(useMonIdentifiant())
  const rang = ONGLETS_PC.findIndex((tab) => tab.id === active)
  const nonLus = useNonLus()

  function press(pressed: TabId) {
    onToucher()
    const action = resolveTabPress({ active, pressed, pathname, memory })
    if (action.kind === 'navigate') void navigate(action.to)
    else onScrollTop(pressed)
  }

  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {rang >= 0 && (
        <span className={styles.curseur} style={{ '--rang': String(rang) }} aria-hidden="true" />
      )}
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={styles.tab}
          data-onglet={tab.id}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => {
            press(tab.id)
          }}
        >
          {tab.id === 'compte' ? (
            <span className={styles.avatar} aria-hidden="true">
              <Avatar url={profil?.avatarUrl ?? null} nom={profil?.nom ?? ''} taille="mini" />
            </span>
          ) : (
            <span
              className={styles.icon}
              style={{ '--icone': `url(${ICONS[tab.id]})` }}
              aria-hidden="true"
            />
          )}
          <Text variant="libelle">{tab.label}</Text>
          {tab.id === 'messages' && (
            <span className={styles.nonLus}>
              <Pastille count={nonLus} />
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
