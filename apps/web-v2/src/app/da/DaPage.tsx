/**
 * QUOI     — la page de référence de la DA, à l'adresse /v2/da.
 * POURQUOI — « pas d'élément sauvage » (décision 007) : tout ce que la V2 a le droit d'afficher
 *            est ici, et nulle part ailleurs. Uriel valide la DA sur cette page.
 */
import { Text } from '@/shared/ui/Text'
import { DaBriques } from './DaBriques'
import { DaFondations } from './DaFondations'
import styles from './DaPage.module.css'

export function DaPage() {
  return (
    <main className={styles.page}>
      <header className={styles.entete}>
        <Text variant="titre-ecran">Direction artistique</Text>
        <Text variant="sous-titre">
          Tout ce que la V2 a le droit d’afficher. Une valeur absente d’ici n’existe pas.
        </Text>
      </header>
      <DaFondations />
      <DaBriques />
    </main>
  )
}
