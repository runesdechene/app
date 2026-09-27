/**
 * QUOI     — le portrait rond d'un Explorateur : sa photo, ou l'initiale de son nom.
 * POURQUOI — beaucoup n'ont pas de photo ; un cercle avec l'initiale vaut mieux qu'un vide.
 *            Trois tailles : « mini » (auteur d'un lieu), « petit » (menu, listes), « grand »
 *            (tête du profil).
 */
import styles from './Avatar.module.css'

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
  if (url) return <img className={className} src={url} alt={nom} />
  return (
    <span className={className} role="img" aria-label={nom}>
      {nom.charAt(0).toUpperCase()}
    </span>
  )
}
