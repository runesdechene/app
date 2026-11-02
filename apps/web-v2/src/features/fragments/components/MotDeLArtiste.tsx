/**
 * QUOI     — « Le mot de l'artiste » : un grand guillemet ocre, le mot en IM Fell English (romain),
 *            l'avatar et la signature ; un mot long se coupe à quatre lignes, « Lire la suite » le
 *            déplie sur place.
 * POURQUOI — maquettes C et D, version A retenue (Uriel, 02/11) : ouvert à tous, c'est la voix
 *            humaine derrière le motif. Souvent deux ou trois paragraphes : il ne doit pas repousser
 *            le reste de la fiche.
 */
import { useState } from 'react'
import { aLaTaille } from '@/shared/lib/image'
import styles from './MotDeLArtiste.module.css'

// Au-delà, le mot se coupe : plusieurs paragraphes, ou plus de quatre lignes de téléphone.
const LONG = 240

export function MotDeLArtiste({
  mot,
  artiste,
  photo,
}: {
  mot: string
  artiste: string | null
  photo: string | null
}) {
  const [ouvert, setOuvert] = useState(false)
  const paragraphes = mot.split(/\n\s*\n/).filter((p) => p.trim() !== '')
  const long = paragraphes.length > 1 || mot.length > LONG
  return (
    <figure className={styles.mot}>
      <span className={styles.guillemet} aria-hidden="true">
        “
      </span>
      <figcaption className={styles.etiquette}>Le mot de l’artiste</figcaption>
      <blockquote className={styles.texte} data-coupe={long && !ouvert ? '' : undefined}>
        {paragraphes.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </blockquote>
      {long && (
        <button
          type="button"
          className={styles.suite}
          aria-expanded={ouvert}
          onClick={() => {
            setOuvert(!ouvert)
          }}
        >
          {ouvert ? 'Replier' : 'Lire la suite'}
        </button>
      )}
      {artiste && (
        <p className={styles.signature}>
          {photo && <img data-avatar src={aLaTaille(photo, 34)} alt="" />}
          {artiste}, l’artiste
        </p>
      )}
    </figure>
  )
}
