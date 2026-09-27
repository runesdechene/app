/**
 * QUOI     — le message centré d'un écran qui n'a encore rien à montrer.
 * POURQUOI — les cinq écrans du socle sont vides ; la maquette leur donne le même traitement :
 *            une ligne en Bebas Neue au centre de l'écran.
 */
import type { ReactNode } from 'react'
import { Text } from './Text'
import styles from './EmptyState.module.css'

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className={styles.empty}>
      <Text variant="titre-section" as="p">
        {children}
      </Text>
    </div>
  )
}
