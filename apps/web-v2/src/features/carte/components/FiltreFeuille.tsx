/**
 * QUOI     — la feuille du bouton Filtre : pour l'instant un seul filtre, « Seulement mes lieux »
 *            (ceux que j'ai découverts, ajoutés ou visités).
 * POURQUOI — spec Carte : un seul bouton, les filtres dans une feuille, jamais en pastilles sur
 *            la carte. Type, saison, accès et bivouac attendent leurs colonnes (plan 2).
 */
import { Feuille } from '@/shared/ui/Feuille'
import { Interrupteur } from '@/shared/ui/Interrupteur'
import styles from './FiltreFeuille.module.css'

export function FiltreFeuille({
  mesLieux,
  onMesLieux,
  onFermer,
}: {
  mesLieux: boolean
  onMesLieux: (valeur: boolean) => void
  onFermer: () => void
}) {
  return (
    <Feuille titre="Filtrer la carte" onFermer={onFermer}>
      <h2 className={styles.titre}>Filtrer la carte</h2>
      <div className={styles.ligne}>
        <span className={styles.nom}>Seulement mes lieux</span>
        <Interrupteur libelle="Seulement mes lieux" actif={mesLieux} onChange={onMesLieux} />
      </div>
    </Feuille>
  )
}
