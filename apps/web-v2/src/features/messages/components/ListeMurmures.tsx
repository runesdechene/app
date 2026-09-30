/**
 * QUOI     — la liste des Murmures (maquette 264:128) : « Les murmures — ce qu'on se dit à voix
 *            basse », un correspondant par ligne (portrait, nom, dernière phrase, moment), et le
 *            sceau Runes de Chêne sur ce qui n'est pas encore lu.
 * POURQUOI — Uriel, 28/09 : « comme un murmure, une douceur » — beaucoup d'air, des filets au
 *            pinceau, ni pastille ni chiffre. Une ligne ouvre la conversation, dans Messages.
 */
import { Link } from 'react-router'
import sceau from '@/assets/ui/sceau-murmure.webp'
import { Avatar } from '@/shared/ui/Avatar'
import { useFils } from '../hooks/useMurmures'
import { moment } from '../lib/moment'
import styles from './Murmures.module.css'

export function ListeMurmures() {
  const { fils, erreur } = useFils()
  return (
    <div className={styles.liste}>
      <h2 className={styles.titre}>Les murmures</h2>
      <p className={styles.sousTitre}>Ce qu’on se dit à voix basse.</p>
      {erreur && <p className={styles.alerte}>Les murmures n’ont pas pu être lus.</p>}
      {fils && fils.length === 0 && (
        <p className={styles.vide}>
          Pas encore de murmure. Depuis le profil d’un Explorateur, « Envoyer un murmure ».
        </p>
      )}
      <ul className={styles.fils}>
        {fils?.map((f) => (
          <li key={f.avec.id}>
            <Link
              className={styles.fil}
              to={`/messages/murmures/${f.avec.id}`}

              data-non-lu={f.nonLus > 0 || undefined}
            >
              <Avatar url={f.avec.avatar} nom={f.avec.nom} taille="petit" />
              <span className={styles.nom}>{f.avec.nom}</span>
              <span className={styles.quand}>{moment(f.dernier.quand)}</span>
              <span className={styles.dernier}>
                {f.dernier.deMoi && 'Toi : '}
                {f.dernier.texte}
              </span>
              {f.nonLus > 0 && (
                <img
                  className={styles.sceau}
                  src={sceau}
                  alt={`${String(f.nonLus)} non lu${f.nonLus > 1 ? 's' : ''}`}
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
