/**
 * QUOI     — le bouton de la V2, en trois sortes : principal, secondaire, discret.
 * POURQUOI — relevé dans la maquette : principal = « Marquer ma visite » (fiche lieu),
 *            secondaire = contour, discret = lien d'action (« Lire ou écouter ce fragment »).
 *            L'état désactivé est celui de « Marquer ma visite (274 km, trop loin) ».
 */
import type { ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonKind = 'principal' | 'secondaire' | 'discret'

export function Button({
  kind = 'principal',
  disabled = false,
  onClick,
  children,
}: {
  kind?: ButtonKind
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={styles[kind]} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
