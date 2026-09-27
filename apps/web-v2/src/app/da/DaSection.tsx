/**
 * QUOI     — une section titrée de la page de DA.
 * POURQUOI — chaque section est une « region » nommée : le test de couverture la retrouve par
 *            son nom, et un lecteur d'écran aussi.
 */
import type { ReactNode } from 'react'
import { Text } from '@/shared/ui/Text'
import styles from './DaPage.module.css'

export function DaSection({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={name}>
      <Text variant="titre-section">{name}</Text>
      {children}
    </section>
  )
}
