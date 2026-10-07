/**
 * QUOI     — la page de référence de la DA, à l'adresse /da, présentée en faux téléphones.
 * POURQUOI — « pas d'élément sauvage » (décision 007) : tout ce que la V2 a le droit d'afficher
 *            est ici, et nulle part ailleurs. Mobile d'abord : chaque élément se montre à la
 *            largeur d'un téléphone. Uriel valide la DA sur cette page.
 */
import { Text } from '@/shared/ui/Text'
import { DaBriques } from './DaBriques'
import { DaCoquille } from './DaCoquille'
import { DaMesures, DaTextes } from './DaFondations'
import { Phone } from './Phone'
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
      <div className={styles.galerie}>
        <Phone titre="La coquille">
          <DaCoquille />
        </Phone>
        <Phone titre="Les textes">
          <DaTextes />
        </Phone>
        <Phone titre="Les briques">
          <DaBriques />
        </Phone>
        <Phone titre="Les mesures">
          <DaMesures />
        </Phone>
      </div>
    </main>
  )
}
