/**
 * QUOI     — la case à cocher des pages publiques (maquette Public/Case 604:1452) : une vraie case,
 *            redessinée, et son texte qui la coche aussi.
 */
import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './CaseACocher.module.css'

export function CaseACocher({
  children,
  ...props
}: { children: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={styles.ligne}>
      <input type="checkbox" className={styles.case} {...props} />
      <span>{children}</span>
    </label>
  )
}
