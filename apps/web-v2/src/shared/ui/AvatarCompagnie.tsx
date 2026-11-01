/**
 * QUOI     — l'avatar d'une Compagnie : son image, ou l'initiale de son nom sur sa couleur.
 * POURQUOI — une Compagnie fondée sans image se reconnaît quand même (maquettes 6 et 2).
 */
import { aLaTaille } from '@/shared/lib/image'
import { teinteCompagnie } from '@/shared/lib/teinte'
import styles from './AvatarCompagnie.module.css'

export function AvatarCompagnie({
  nom,
  avatar,
  couleur,
  taille,
}: {
  nom: string
  avatar: string | null
  couleur: string
  taille: number
}) {
  return (
    <span
      className={styles.avatar}
      style={{ ...teinteCompagnie(couleur), '--mesure': `${String(taille)}px` }}
      data-grand={taille >= 64 || undefined}
      aria-hidden="true"
    >
      {avatar ? (
        <img src={aLaTaille(avatar, taille * 2)} alt="" loading="lazy" />
      ) : (
        nom.replace(/^(L[ea]s? |L’|L')/i, '').charAt(0)
      )}
    </span>
  )
}
