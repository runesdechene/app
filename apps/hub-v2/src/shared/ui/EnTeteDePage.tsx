/**
 * QUOI     — l'en-tête d'un écran du Hub : surtitre (le domaine), titre, phrase, et à droite un bouton.
 * POURQUOI — le même en-tête que l'ouverture (maquettes 587:761, 594:961), une seule fois.
 */
import type { ReactNode } from 'react'
import styles from './EnTeteDePage.module.css'

export function EnTeteDePage({ surtitre, titre, phrase, aDroite }: {
  surtitre: string; titre: string; phrase?: string; aDroite?: ReactNode
}) {
  return (
    <header className={styles.entete}>
      <div className={styles.textes}>
        <p className={styles.surtitre}>{surtitre}</p>
        <h1 className={styles.titre}>{titre}</h1>
        {phrase && <p className={styles.phrase}>{phrase}</p>}
      </div>
      {aDroite}
    </header>
  )
}
