/**
 * QUOI     — la coquille du Hub : le menu à gauche sur PC, la barre d'onglets sur téléphone,
 *            l'écran ouvert au milieu.
 * POURQUOI — la bascule PC/téléphone suit la largeur (container queries, comme la V2).
 */
import { Outlet } from 'react-router'
import { BarreDOnglets } from './BarreDOnglets'
import { MenuDuPC } from './MenuDuPC'
import styles from './Coquille.module.css'

export function Coquille() {
  return (
    <div className={styles.coquille}>
      <div className={styles.menu}>
        <MenuDuPC />
      </div>
      <main className={styles.contenu}>
        <Outlet />
      </main>
      <div className={styles.onglets}>
        <BarreDOnglets />
      </div>
    </div>
  )
}
