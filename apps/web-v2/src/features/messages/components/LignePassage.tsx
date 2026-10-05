/**
 * QUOI     — une arrivée dans le Registre : « Kelpie a rejoint EXPLORE ! Souhaite-lui la
 *            bienvenue ! »
 * POURQUOI — Uriel, 01/10 : les bienvenues vivent dans le Registre. Puis, 05/10 : plus discrète,
 *            sans portrait (un nouveau venu n'en a jamais encore). La ligne est centrée, sans
 *            bulle de message : on voit que personne ne parle. La bienvenue s'écrit sur
 *            place, la personne déjà mentionnée. On ne se souhaite pas la bienvenue à soi-même.
 */
import { Link } from 'react-router'
import cheminArrivee from '@/assets/ui/chemin-arrivee.svg'
import type { Passage, Personne } from '../api/lireRegistre'
import { heureDe } from '../lib/jour'
import styles from './LignePassage.module.css'

export function LignePassage({
  passage,
  onBienvenue,
}: {
  passage: Passage
  onBienvenue: (p: Personne) => void
}) {
  const { qui } = passage
  return (
    <li className={styles.arrivee}>
      <img src={cheminArrivee} alt="" width={14} height={14} />
      <p className={styles.texte}>
        <Link className={styles.nom} to={`/messages/explorateur/${qui.id}`}>
          {qui.nom}
        </Link>{' '}
        a rejoint EXPLORE !
        {!passage.moi && (
          <>
            {' '}
            <button
              type="button"
              className={styles.bienvenue}
              onClick={() => {
                onBienvenue(qui)
              }}
            >
              Souhaite-lui la bienvenue !
            </button>
          </>
        )}
      </p>
      <time className={styles.heure} dateTime={passage.quand}>
        {heureDe(passage.quand)}
      </time>
    </li>
  )
}
