/**
 * QUOI     — un faux téléphone (390 × 844, la maquette) pour présenter la DA en mobile.
 * POURQUOI — mobile d'abord : chaque élément se juge à la largeur où il vivra. L'écran du
 *            téléphone est un conteneur « app » : la coquille y prend sa forme mobile même sur
 *            un grand écran (container queries).
 * ATTENTION — sur un vrai téléphone, le cadre disparaît : pas de téléphone dans le téléphone.
 */
import type { ReactNode } from 'react'
import { Text } from '@/shared/ui/Text'
import styles from './Phone.module.css'

export function Phone({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <figure className={styles.phone}>
      <div className={styles.ecran}>{children}</div>
      <figcaption className={styles.legende}>
        <Text variant="rubrique" as="span">
          {titre}
        </Text>
      </figcaption>
    </figure>
  )
}
