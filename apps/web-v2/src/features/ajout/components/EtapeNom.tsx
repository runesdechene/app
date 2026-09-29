/**
 * QUOI     — l'étape « Son nom, sa nature, son époque » (maquette 291:146) : la photo en tête, déjà
 *            séparée du parchemin par la lisière comme sur la fiche ; le nom en grand ; les natures
 *            (trois au plus, numérotées dans l'ordre du choix, la première donne sa couleur au
 *            lieu) ; l'époque, ou « je ne sais pas » ; l'année sur demande.
 * POURQUOI — la fiche prend forme : le nom s'écrit comme le titre qu'il deviendra. Une nature
 *            porte sa bille — son icône, puis son rang dès qu'on la choisit. Rien n'est obligatoire
 *            hors le nom et une nature : l'époque et l'année aident, sans bloquer.
 */
import { useUrlDe } from '../hooks/useUrlDe'
import { ceQuiManque, type ProprietesEtape } from '../lib/brouillon'
import { BoutonSuivant } from './BoutonSuivant'
import { ChampsDuLieu } from './ChampsDuLieu'
import styles from './EtapeNom.module.css'

export function EtapeNom({ brouillon, changer, onSuivant }: ProprietesEtape) {
  const photo = useUrlDe(brouillon.photos[0]?.grande)
  return (
    <div className={styles.nom}>
      <div className={styles.photo}>{photo && <img src={photo} alt="" />}</div>

      <div className={styles.corps}>
        <ChampsDuLieu valeur={brouillon} changer={changer} />
      </div>

      <BoutonSuivant
        libelle="Continuer"
        manque={ceQuiManque(brouillon, 'nom')}
        onClick={onSuivant}
      />
    </div>
  )
}
