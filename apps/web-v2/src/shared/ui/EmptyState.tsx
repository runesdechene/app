/**
 * QUOI     — le message centré d'un écran qui n'a encore rien à montrer.
 * POURQUOI — les cinq écrans du socle sont vides ; la maquette leur donne le même traitement.
 */
import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>
}
