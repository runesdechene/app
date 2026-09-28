/**
 * QUOI     — la coquille réelle (logotype, avatar, écran vide, barre d'onglets) dans un téléphone.
 * POURQUOI — la barre d'onglets est le VRAI composant de l'app, pas une copie : ce qu'on valide
 *            ici est ce qui s'affiche. `inert` la rend non cliquable : on la montre, on ne
 *            navigue pas depuis la page de DA.
 */
import logotype from '@/assets/ui/logotype.png'
import { EmptyState } from '@/shared/ui/EmptyState'
import { TabBar } from '../shell/TabBar'
import styles from './DaPage.module.css'

function ignore() {
  // La barre est inerte sur cette page : aucun défilement à remonter.
}

export function DaCoquille() {
  return (
    <div className={styles.coquille} inert>
      <div className={styles.bandeau}>
        <img className={styles.logo} src={logotype} alt="Runes de Chêne" />
        <span className={styles.avatar} />
      </div>
      <EmptyState>Le Campement est à venir</EmptyState>
      <TabBar onScrollTop={ignore} onToucher={ignore} />
    </div>
  )
}
