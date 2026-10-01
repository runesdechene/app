/**
 * QUOI     — le portrait rond d'un Explorateur : sa photo, ou l'initiale de son nom.
 * POURQUOI — beaucoup n'ont pas de photo ; un cercle avec l'initiale vaut mieux qu'un vide.
 *            Trois tailles : « mini » (auteur d'un lieu), « petit » (menu, listes), « grand »
 *            (120 px : le même portrait sur le profil et dans Modifier mon profil, Uriel 27/09).
 */
import { aLaTaille } from '@/shared/lib/image'
import styles from './Avatar.module.css'

// La largeur affichée de chaque format (Avatar.module.css) : l'image arrive à cette taille.
const PIXELS = { mini: 22, petit: 36, grand: 120 } as const

export function Avatar({
  url,
  nom,
  taille,
}: {
  url: string | null
  nom: string
  taille: 'mini' | 'petit' | 'grand'
}) {
  const className = [styles.avatar, styles[taille]].join(' ')
  if (url) {
    return (
      <img
        className={className}
        src={aLaTaille(url, PIXELS[taille])}
        alt={nom}
        loading="lazy"
        decoding="async"
      />
    )
  }
  return (
    <span className={className} role="img" aria-label={nom}>
      {nom.charAt(0).toUpperCase()}
    </span>
  )
}
