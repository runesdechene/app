/**
 * QUOI     — le champ bordé du flyer cadeau (maquette Public/Champ 604:1440) : le libellé en
 *            Bebas dans la carte, la saisie soulignée dessous.
 * POURQUOI — le libellé est un vrai <label> : on touche la carte, on écrit.
 */
import type { InputHTMLAttributes } from 'react'
import styles from './Champ.module.css'

export function Champ({ libelle, ...props }: { libelle: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={styles.champ}>
      <span className={styles.libelle}>{libelle}</span>
      <input className={styles.saisie} {...props} />
    </label>
  )
}
