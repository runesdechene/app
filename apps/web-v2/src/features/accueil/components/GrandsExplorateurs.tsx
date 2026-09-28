/**
 * QUOI     — « Les Grands Explorateurs » sur l'Accueil (maquette 275:128) : ceux qui ont le plus
 *            marché ce mois-ci, cinq lignes, ma place ; « Voir tout le classement » ouvre la page
 *            du classement dans l'Accueil.
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
  const classement = useGrandsExplorateurs('visites', 'mois')
  if (!classement || classement.tete.length === 0) return null
  return (
    <section className={styles.grands} aria-label="Les Grands Explorateurs">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionGrandsExplorateurs} alt="" />
        Les Grands Explorateurs
      </h2>
      <p className={styles.chapo}>Ceux qui ont le plus marché ce mois-ci</p>
      <Classement classement={classement} type="visites" periode="mois" lignes={5} />
      <Link className={styles.tout} to="/accueil/classement" state={VENU_D_UN_ECRAN}>
        Voir tout le classement
      </Link>
    </section>
  )
}
