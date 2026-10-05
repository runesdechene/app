/**
 * QUOI     — les arrivées dans le Registre : « Kelpie a rejoint EXPLORE ! », ou, à plusieurs
 *            d'affilée, « Kelpie et Ash ont rejoint EXPLORE ! » — au-delà de trois, « et 4 autres »,
 *            la liste au toucher.
 * POURQUOI — Uriel, 05/10 : discrète, sans portrait (un nouveau venu n'en a jamais encore), et
 *            alignée sur la conversation — la petite icône dans la colonne des portraits, le texte
 *            dans celle des noms, l'heure à droite. Pas de bouton de bienvenue : 10 à 20
 *            inscriptions d'un coup feraient trop de mentions ; chacun l'écrit s'il en a envie.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import cheminArrivee from '@/assets/ui/chemin-arrivee.svg'
import { Feuille } from '@/shared/ui/Feuille'
import type { Passage } from '../api/lireRegistre'
import { phraseDesArrivees } from '../lib/arrivees'
import { heureDe } from '../lib/jour'
import styles from './LignePassage.module.css'

export function LignePassage({ passages }: { passages: Passage[] }) {
  const [liste, setListe] = useState(false)
  const dernier = passages.at(-1)
  if (!dernier) return null
  const phrase = phraseDesArrivees(passages.map((p) => p.qui.nom))
  const [seul] = passages

  return (
    <li className={styles.arrivees}>
      <img className={styles.icone} src={cheminArrivee} alt="" width={14} height={14} />
      <p className={styles.texte}>
        {passages.length === 1 && seul ? (
          <Link className={styles.nom} to={`/messages/explorateur/${seul.qui.id}`}>
            {seul.qui.nom}
          </Link>
        ) : passages.length > 3 ? (
          <button
            type="button"
            className={styles.qui}
            onClick={() => {
              setListe(true)
            }}
          >
            {phrase.qui}
          </button>
        ) : (
          <span className={styles.nom}>{phrase.qui}</span>
        )}{' '}
        {phrase.verbe}
      </p>
      <time className={styles.heure} dateTime={dernier.quand}>
        {heureDe(dernier.quand)}
      </time>

      {liste && (
        <Feuille
          titre="Nouveaux venus"
          onFermer={() => {
            setListe(false)
          }}
        >
          <ul className={styles.liste}>
            {passages.map((p) => (
              <li key={p.id}>
                <Link className={styles.personne} to={`/messages/explorateur/${p.qui.id}`}>
                  {p.qui.nom}
                </Link>
              </li>
            ))}
          </ul>
        </Feuille>
      )}
    </li>
  )
}
