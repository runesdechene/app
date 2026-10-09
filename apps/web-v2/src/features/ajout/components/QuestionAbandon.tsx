/**
 * QUOI     — « Abandonner tes changements ? » : continuer à modifier, ou abandonner.
 * POURQUOI — Uriel, 30/09 : quitter « Modifier la fiche » avec des changements en cours demande
 *            d'abord confirmation. Même feuille, même style que « Quitter l'ajout ».
 */
import { Feuille } from '@/shared/ui/Feuille'
import styles from './ParcoursAjout.module.css'

export function QuestionAbandon({
  onContinuer,
  onAbandonner,
}: {
  onContinuer: () => void
  onAbandonner: () => void
}) {
  return (
    <Feuille titre="Abandonner tes changements ?" onFermer={onContinuer}>
      <p className={styles.question}>Abandonner tes changements ?</p>
      <p className={styles.explication}>Ce que tu as modifié ne sera pas enregistré.</p>
      <div className={styles.choix}>
        <button type="button" className={styles.garder} onClick={onContinuer}>
          Continuer à modifier
        </button>
        <button type="button" className={styles.jeter} onClick={onAbandonner}>
          Abandonner
        </button>
      </div>
    </Feuille>
  )
}
