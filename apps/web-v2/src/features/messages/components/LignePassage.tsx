/**
 * QUOI     — un passage dans le Registre : « Kelpie a rejoint EXPLORE ! Souhaite-lui la
 *            bienvenue ! », ou, plus discret, « Kelpie vient de se connecter ».
 * POURQUOI — Uriel, 01/10 : les gens qui passent vivent dans le Registre. La ligne est centrée,
 *            sans bulle de message : on voit que personne ne parle. La bienvenue s'écrit sur
 *            place, la personne déjà mentionnée. On ne se souhaite pas la bienvenue à soi-même.
 */
import { Link } from 'react-router'
import cheminArrivee from '@/assets/ui/chemin-arrivee.svg'
import pas from '@/assets/ui/pas.svg'
import { Avatar } from '@/shared/ui/Avatar'
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
  const arrivee = passage.type === 'arrivee'
  return (
    <li className={arrivee ? styles.arrivee : styles.connexion}>
      <img src={arrivee ? cheminArrivee : pas} alt="" width={14} height={14} />
      {arrivee && <Avatar url={qui.avatar} nom={qui.nom} taille="mini" />}
      <p className={styles.texte}>
        <Link className={styles.nom} to={`/messages/explorateur/${qui.id}`}>
          {qui.nom}
        </Link>{' '}
        {arrivee ? 'a rejoint EXPLORE !' : 'vient de se connecter'}
        {arrivee && !passage.moi && (
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
