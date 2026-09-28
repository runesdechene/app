/**
 * QUOI     — la page du fil « Sur les chemins », ouverte dans le tiroir par « Voir toute
 *            l'activité » : toute l'activité récente (cinquante lignes au plus), et l'on y salue.
 * POURQUOI — une page et non un fil qui s'allonge sous l'Accueil (Uriel, 29/09) : elle a son
 *            adresse, /accueil/chemins, et le retour du navigateur la referme.
 */
import { useChemins } from '../hooks/useAccueil'
import { FilDesChemins } from './SurLesChemins'
import styles from './PageChemins.module.css'

export function PageChemins() {
  const { chemins } = useChemins()
  if (!chemins) return null
  return (
    <div className={styles.page}>
      <FilDesChemins chemins={chemins} />
    </div>
  )
}
