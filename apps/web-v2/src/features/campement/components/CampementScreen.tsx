/**
 * QUOI     — l'onglet Campement, en attendant sa première page : il dit qu'il ouvre bientôt.
 * POURQUOI — la barre suit le verso du dépliant (Carte, Codex, Campement : Uriel, 02/11) ; la
 *            première page du Campement a son propre plan.
 */
import { Text } from '@/shared/ui/Text'
import styles from './CampementScreen.module.css'

export function CampementScreen() {
  return (
    <section className={styles.ecran}>
      <Text variant="titre-ecran">Le Campement</Text>
      <Text variant="corps">Le coin du feu des Porteurs ouvre bientôt.</Text>
    </section>
  )
}
