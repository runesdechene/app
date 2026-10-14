/**
 * QUOI     — le titre d'une section comme dans l'appli : icône gravée, Bebas, filet jusqu'au bord.
 */
import type { ReactNode } from 'react'
import styles from './TitreDeSection.module.css'

export function TitreDeSection({ titre, icone, aDroite }: { titre: string; icone?: string; aDroite?: ReactNode }) {
  return (
    <div className={styles.titre}>
      {icone && <img className={styles.icone} src={icone} alt="" />}
      <h2 className={styles.texte}>{titre}</h2>
      <span className={styles.filet} />
      {aDroite}
    </div>
  )
}
