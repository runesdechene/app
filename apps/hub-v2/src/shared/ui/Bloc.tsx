/**
 * QUOI     — le bloc clair, arrondi et bordé des listes du Hub (maquette 587:761).
 */
import type { ReactNode } from 'react'
import styles from './Bloc.module.css'

export function Bloc({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `${styles.bloc ?? ''} ${className}` : styles.bloc}>{children}</div>
}
