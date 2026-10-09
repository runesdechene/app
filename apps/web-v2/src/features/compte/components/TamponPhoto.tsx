/**
 * QUOI     — la photo encrée : la photo du lieu en bichrome, à la couleur de sa nature, dans
 *            un disque cerclé de pointillés, et sa date en pastille (maquette « Passeport — 2 »).
 * POURQUOI — « J'aime bien la photo encrée » (Uriel, 06/10) : une photo, mais qui reste un
 *            tampon. Sans photo, le disque prend la couleur de la nature et son icône.
 * ATTENTION — le bichrome se fait en CSS (niveaux de gris, puis la couleur en `lighten`, puis
 *            le papier en `darken`) : `isolation: isolate` garde ces mélanges dans le disque.
 */
import { aLaTaille } from '@/shared/lib/image'
import type { Nature, Tampon } from '../api/lirePasseport'
import styles from './TamponPhoto.module.css'

export function TamponPhoto({
  tampon,
  nature,
  date,
}: {
  tampon: Tampon
  nature: Nature | null
  date: string
}) {
  return (
    <span
      className={styles.tampon}
      role="img"
      aria-label={`${tampon.nom}, ${date}`}
      style={{
        '--couleur': nature?.couleur ?? 'var(--color-ocre)',
        '--icone': nature ? `url(${nature.icone})` : 'none',
      }}
    >
      <span className={styles.disque} aria-hidden="true">
        {tampon.imageUrl ? (
          <>
            <img
              className={styles.photo}
              src={aLaTaille(tampon.imageUrl, 96)}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className={styles.encre} />
            <span className={styles.papier} />
          </>
        ) : (
          <span className={styles.icone} />
        )}
      </span>
      <span className={styles.date} aria-hidden="true">
        {date}
      </span>
    </span>
  )
}
