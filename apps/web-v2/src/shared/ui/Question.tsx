/**
 * QUOI     — la feuille qui pose une question (ou annonce quelque chose) : un titre, une phrase,
 *            puis les choix, empilés.
 * POURQUOI — six feuilles la recopiaient : la nouvelle version, les invitations (position,
 *            installation), les questions du brouillon d'Ajouter. Une seule brique (Uriel, 31/10).
 * ATTENTION — les choix arrivent en enfants : chaque écran garde ses boutons.
 */
import type { ReactNode } from 'react'
import { Feuille } from './Feuille'
import styles from './Question.module.css'

export function Question({
  titre,
  explication,
  onFermer,
  children,
}: {
  titre: string
  explication: ReactNode
  onFermer: () => void
  children: ReactNode
}) {
  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <p className={styles.titre}>{titre}</p>
      <p className={styles.explication}>{explication}</p>
      <div className={styles.choix}>{children}</div>
    </Feuille>
  )
}
