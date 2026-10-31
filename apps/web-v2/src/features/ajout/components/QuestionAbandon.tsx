/**
 * QUOI     — « Abandonner tes changements ? » : continuer à modifier, ou abandonner.
 * POURQUOI — Uriel, 30/09 : quitter « Modifier la fiche » avec des changements en cours demande
 *            d'abord confirmation. Même feuille, même style que « Quitter l'ajout ».
 */
import { Question } from '@/shared/ui/Question'
import styles from './ParcoursAjout.module.css'

export function QuestionAbandon({
  onContinuer,
  onAbandonner,
}: {
  onContinuer: () => void
  onAbandonner: () => void
}) {
  return (
    <Question
      titre="Abandonner tes changements ?"
      explication="Ce que tu as modifié ne sera pas enregistré."
      onFermer={onContinuer}
    >
      <button type="button" className={styles.garder} onClick={onContinuer}>
        Continuer à modifier
      </button>
      <button type="button" className={styles.jeter} onClick={onAbandonner}>
        Abandonner
      </button>
    </Question>
  )
}
