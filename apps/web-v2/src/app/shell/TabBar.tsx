/**
 * QUOI     — la barre des cinq onglets : icône gravée + libellé, lisière de forêt au-dessus.
 * POURQUOI — un toucher est traduit par resolveTabPress (règles mobiles) puis appliqué ici.
 * ATTENTION — ce sont des <button>, pas des <a> : un onglet n'ouvre pas toujours son adresse
 *            (mémoire, double toucher). aria-current marque l'onglet actif pour les lecteurs
 *            d'écran. Les icônes sont décoratives (alt="") : le libellé porte le nom.
 */
import { useLocation, useNavigate } from 'react-router'
import accueilIcon from '@/assets/ui/onglet-accueil.png'
import campementIcon from '@/assets/ui/onglet-campement.png'
import carteIcon from '@/assets/ui/onglet-carte.png'
import codexIcon from '@/assets/ui/onglet-codex.png'
import messagesIcon from '@/assets/ui/onglet-messages.png'
import { Text } from '@/shared/ui/Text'
import { resolveTabPress, tabOf, TABS, type TabId } from '../navigation/tabs'
import { useTabMemory } from '../navigation/useTabMemory'
import styles from './TabBar.module.css'

const ICONS: Record<TabId, string> = {
  accueil: accueilIcon,
  carte: carteIcon,
  messages: messagesIcon,
  codex: codexIcon,
  campement: campementIcon,
}

export function TabBar({ onScrollTop }: { onScrollTop: (tab: TabId) => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const memory = useTabMemory()
  const active = tabOf(pathname)

  function press(pressed: TabId) {
    const action = resolveTabPress({ active, pressed, pathname, memory })
    if (action.kind === 'navigate') void navigate(action.to)
    else onScrollTop(pressed)
  }

  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={styles.tab}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => {
            press(tab.id)
          }}
        >
          <img className={styles.icon} src={ICONS[tab.id]} alt="" />
          <Text variant="libelle">{tab.label}</Text>
        </button>
      ))}
    </nav>
  )
}
