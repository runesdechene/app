/**
 * QUOI     — le Préambule (maquette 94:142) : l'emblème, et la lettre d'Uriel à ceux qui entrent.
 * POURQUOI — avant les règles, la raison d'être : un projet annexe, gratuit, financé par la marque.
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
          Cette application fut conçue sur mon temps libre, souvent la nuit, avec le rêve de
          redonner vie à nos régions et d’inspirer.
        </p>
        <p>
          Sa seule prétention est de vous faire découvrir, d’échanger, de collectionner des points
          d’intérêt uniques autour de l’Histoire, du patrimoine et de la Nature, sur les traces de
          nos ancêtres.
        </p>
        <p>
          Elle est un projet annexe, gratuit, et auto-financé par les revenus dégagés de la marque
          Runes de Chêne. Chaque vêtement vendu finance des initiatives comme celle-ci, pour
          réenchanter le monde moderne, en y ramenant un peu de la beauté du passé.
        </p>
        <p>
          Camaraderie, amour des vieilles pierres, évasion sauvage, chants au coin du feu, aventure
          et audace… entre nomadisme et héritage culturel. Une confrérie silencieuse de voyageurs et
          d’explorateurs-érudits. Voilà ce qu’on essaie de créer ici. J’espère qu’elle vous plaira.
        </p>
        <p className={styles.signature}>
          <strong>Uriel</strong>
          <em>Artiste nomade,</em>
          <em>Créateur de Runes de Chêne</em>
        </p>
      </div>
    </Page>
  )
}
