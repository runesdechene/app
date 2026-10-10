/**
 * QUOI     — la feuille « Les cœurs » (maquette « Lieu — les cœurs (feuille) », 30/09) : qui a
 *            envoyé des cœurs, avec son visage et son nombre, les plus généreux d'abord.
 * POURQUOI — Uriel, 30/09 : « voir l'avatar et le nombre de cœurs envoyés des gens qui ont liké ».
 *            La même pour un lieu et pour une mise à jour : elle reçoit les cœurs déjà lus.
 */
import type { Coeurs } from '@/shared/lib/carnet'
import { Avatar } from './Avatar'
import { Feuille } from './Feuille'
import styles from './FeuilleDesCoeurs.module.css'

export function FeuilleDesCoeurs({
  coeurs,
  onFermer,
}: {
  coeurs: Coeurs | null
  onFermer: () => void
}) {
  return (
    <Feuille titre="Les cœurs" onFermer={onFermer}>
      <h2 className={styles.titre}>Les cœurs · {coeurs?.total ?? '…'}</h2>
      <ul className={styles.gens}>
        {coeurs?.gens.map((p) => (
          <li key={p.id} className={styles.personne}>
            <Avatar url={p.avatar} nom={p.nom} taille="petit" />
            <span className={styles.nomPersonne}>{p.nom}</span>
            <span className={styles.nombreCoeurs}>
              <span className={styles.petitCoeur} aria-hidden="true" />
              {p.nombre}
            </span>
          </li>
        ))}
      </ul>
    </Feuille>
  )
}
