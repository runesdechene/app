/**
 * QUOI     — la feuille « Les cœurs » (maquette « Lieu — les cœurs (feuille) », 30/09) : qui a
 *            envoyé des cœurs à ce lieu, avec son visage et son nombre, les plus généreux d'abord.
 * POURQUOI — Uriel, 30/09 : « voir l'avatar et le nombre de cœurs envoyés des gens qui ont liké ».
 *            Elle s'ouvre depuis la rangée des visages, ou la pastille sur son propre lieu.
 */
import { Avatar } from '@/shared/ui/Avatar'
import { Feuille } from '@/shared/ui/Feuille'
import { useCoeurs } from '../hooks/useCoeurs'
import styles from './Feuilles.module.css'

export function FeuilleCoeurs({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { coeurs } = useCoeurs(id)
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
