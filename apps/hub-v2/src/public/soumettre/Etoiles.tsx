/**
 * QUOI     — une note en cinq étoiles (« La qualité du textile », « Ton expérience avec Runes de
 *            Chêne »), dans « Ton histoire » comme dans « Ton avis ».
 * POURQUOI — cliquer l'étoile déjà choisie retire la note ; le survol allume les étoiles jusqu'au
 *            pointeur, pour voir la note avant de la poser.
 */
import { useState } from 'react'
import styles from './Etoiles.module.css'

export function Etoiles({ nom, note, noter }: { nom: string; note: number; noter: (n: number) => void }) {
  const [survol, setSurvol] = useState(0)
  return (
    <div className={styles.etoiles} role="group" aria-label={nom}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={styles.etoile}
          data-allumee={n <= (survol || note)}
          aria-label={`${String(n)} sur 5`}
          aria-pressed={n === note}
          onClick={() => {
            noter(n === note ? 0 : n)
          }}
          onMouseEnter={() => {
            setSurvol(n)
          }}
          onMouseLeave={() => {
            setSurvol(0)
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}
