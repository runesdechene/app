/**
 * QUOI     — l'écran d'un domaine pas encore repris : son nom, et le lien vers l'ancien Hub.
 * POURQUOI — le menu est complet dès le plan 1 ; les écrans arrivent plan par plan (spec §12).
 * ATTENTION — chaque plan suivant remplace une de ces routes ; à la bascule (plan 5), il n'en
 *            reste aucune et ce fichier est supprimé.
 */
import { useLocation } from 'react-router'
import { MENU } from './menu'
import styles from './BientotIci.module.css'

export function BientotIci() {
  const { pathname } = useLocation()
  const lien = MENU.flatMap((d) => d.liens).find((l) => l.chemin === pathname)
  return (
    <section className={styles.ecran}>
      <h1 className={styles.titre}>{lien?.libelle ?? 'Cet écran'}</h1>
      <p>Cet écran arrive bientôt dans le nouveau Hub.</p>
      <a href="https://hub.runesdechene.com">Ouvrir l’ancien Hub</a>
    </section>
  )
}
