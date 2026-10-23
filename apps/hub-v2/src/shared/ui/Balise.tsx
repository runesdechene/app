/**
 * QUOI     — une gélule colorée : la balise d'un compte (Nouveau, Porteur…) ou le type d'une
 *            ligne du fil.
 */
import styles from './Balise.module.css'

export type Teinte =
  | 'nouveau' | 'reactive' | 'sommeil' | 'porteur' | 'admin'
  | 'actif' | 'pause'
  | 'compte' | 'lieu' | 'visite' | 'enigme' | 'boutique' | 'photo' | 'message' | 'moderation' | 'notification'

export function Balise({ texte, teinte }: { texte: string; teinte: Teinte }) {
  return (
    <span className={styles.balise} data-teinte={teinte}>
      {texte}
    </span>
  )
}
