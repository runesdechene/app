/**
 * QUOI     — la barre des cinq onglets.
 * POURQUOI — un toucher est traduit par resolveTabPress (règles mobiles) puis appliqué ici.
 * ATTENTION — ce sont des <button>, pas des <a> : un onglet n'ouvre pas toujours son adresse
 *            (mémoire, double toucher). aria-current marque l'onglet actif pour les lecteurs
 *            d'écran.
 */
import { useLocation, useNavigate } from 'react-router'
import { resolveTabPress, tabOf, TABS, type TabId } from '../navigation/tabs'
import { useTabMemory } from '../navigation/useTabMemory'
import styles from './TabBar.module.css'

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
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
