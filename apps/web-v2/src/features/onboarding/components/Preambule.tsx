/**
 * QUOI     — le Préambule (maquette 94:142) : l'emblème, et la lettre d'Uriel à ceux qui entrent.
 * POURQUOI — avant les règles, la raison d'être : une confrérie, gratuite, financée par la marque.
 *            Tutoyée comme tout le parcours ; réécrite avec Uriel le 30/09 (le meilleur en tête).
 */
import embleme from '@/assets/onboarding/embleme.webp'
import { useParcours } from '../hooks/useParcours'
import styles from './Onboarding.module.css'
import { Page, Suivant } from './Page'

export function Preambule() {
  const { aller } = useParcours()
  return (
    <Page
      bas={
        <Suivant
          onClick={() => {
            aller('charte')
          }}
        />
      }
    >
      <img className={styles.embleme} src={embleme} alt="" />
      <h1 className={styles.titre}>Préambule</h1>
      <div className={styles.lettre}>
        <p>
          Cette application est née la nuit, sur mon temps libre, d’un rêve : redonner vie à nos
          régions.
        </p>
        <p>
          Camaraderie, amour des vieilles pierres, évasion sauvage, chants au coin du feu… Entre
          nomadisme et héritage, une confrérie de voyageurs et d’explorateurs-érudits, sur les
          traces de nos ancêtres. Voilà ce qu’on essaie de bâtir ici.
        </p>
        <p>
          Elle est gratuite, et le restera : chaque vêtement Runes de Chêne vendu la finance, pour
          ramener un peu de la beauté du passé dans le monde moderne.
        </p>
        <p>J’espère qu’elle te plaira.</p>
        <p className={styles.signature}>
          <strong>Uriel</strong>
          <em>Artiste nomade,</em>
          <em>Créateur de Runes de Chêne</em>
        </p>
      </div>
    </Page>
  )
}
