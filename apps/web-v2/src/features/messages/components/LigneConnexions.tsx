/**
 * QUOI     — des connexions d'affilée dans le Registre, en une seule ligne discrète : la trace de
 *            pas, les portraits, « Kelpie, Ash et 4 autres se sont connectés », l'heure de la
 *            dernière. À plusieurs, la ligne ouvre la liste de qui est passé.
 * POURQUOI — Uriel, 05/10 : une ligne par connexion, « c'était trop » ; la conversation s'y
 *            noyait. Les plus récents sont nommés d'abord.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import pas from '@/assets/ui/pas.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { Feuille } from '@/shared/ui/Feuille'
import type { Passage } from '../api/lireRegistre'
import { phraseDesConnexions } from '../lib/connexions'
import { heureDe } from '../lib/jour'
import styles from './LigneConnexions.module.css'

const PORTRAITS = 3

export function LigneConnexions({ passages }: { passages: Passage[] }) {
  const [liste, setListe] = useState(false)
  const recents = [...passages].reverse()
  const [dernier] = recents
  if (!dernier) return null
  const phrase = phraseDesConnexions(recents.map((p) => p.qui.nom))

  return (
    <li className={styles.connexions}>
      <img src={pas} alt="" width={14} height={14} />
      {recents.length === 1 ? (
        <p className={styles.texte}>
          <Link className={styles.nom} to={`/messages/explorateur/${dernier.qui.id}`}>
            {dernier.qui.nom}
          </Link>{' '}
          vient de se connecter
        </p>
      ) : (
        <button
          type="button"
          className={styles.groupe}
          onClick={() => {
            setListe(true)
          }}
        >
          <span className={styles.portraits}>
            {recents.slice(0, PORTRAITS).map((p) => (
              <Avatar key={p.id} url={p.qui.avatar} nom={p.qui.nom} taille="mini" />
            ))}
          </span>
          {phrase}
        </button>
      )}
      <time className={styles.heure} dateTime={dernier.quand}>
        {heureDe(dernier.quand)}
      </time>

      {liste && (
        <Feuille
          titre="Passés par ici"
          onFermer={() => {
            setListe(false)
          }}
        >
          <ul className={styles.liste}>
            {recents.map((p) => (
              <li key={p.id}>
                <Link className={styles.personne} to={`/messages/explorateur/${p.qui.id}`}>
                  <Avatar url={p.qui.avatar} nom={p.qui.nom} taille="mini" />
                  <span className={styles.qui}>{p.qui.nom}</span>
                  <time className={styles.heure} dateTime={p.quand}>
                    {heureDe(p.quand)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Feuille>
      )}
    </li>
  )
}
