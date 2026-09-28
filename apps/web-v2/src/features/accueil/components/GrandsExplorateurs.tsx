/**
 * QUOI     — « Les Grands Explorateurs » sur l'Accueil (maquette 275:128) : ceux qui ont le plus
 *            marché ce mois-ci, trois lignes (Uriel, 29/09 : « bien assez ») ; « Voir tout le
 *            classement » ouvre la page du classement dans l'Accueil. Ma ligne n'y paraît que si je
 *            suis parmi les trois ; ma place, sinon, est dans la page.
 * POURQUOI — l'Accueil reste simple (Uriel, 29/09 : les choix du classement le rendaient
 *            « bordélique ») : ici, un seul classement, celui du mois qui repart à zéro ; les
 *            autres vivent dans la page. Validé contre la spec V2 §5, qui excluait tout classement.
 *            Personne n'a encore marché ce mois-ci : le bloc ne s'affiche pas.
 */
import { Link } from 'react-router'
import sectionGrandsExplorateurs from '@/assets/ui/section-nouvelles.png'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { useGrandsExplorateurs } from '../hooks/useAccueil'
import { Classement } from './Classement'
import styles from './GrandsExplorateurs.module.css'

export function GrandsExplorateurs() {
  const classement = useGrandsExplorateurs('visites', '30jours')
  if (!classement || classement.tete.length === 0) return null
  return (
    <section className={styles.grands} aria-label="Le Panthéon">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionGrandsExplorateurs} alt="" />
        Le Panthéon
      </h2>
      <Classement
        classement={classement}
        type="visites"

        lignes={3}
        avecMaPlace={false}
      />
      <Link className={styles.tout} to="/accueil/classement" state={VENU_D_UN_ECRAN}>
        Voir tout le classement
      </Link>
    </section>
  )
}
