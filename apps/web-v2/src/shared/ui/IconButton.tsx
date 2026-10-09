/**
 * QUOI     — un bouton rond qui ne montre qu'une icône (partager, envoyer, ajouter).
 * POURQUOI — sans texte visible, le libellé passe en aria-label : un lecteur d'écran l'annonce.
 */
import styles from './IconButton.module.css'

export function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: string
  onClick?: () => void
}) {
  return (
    <button type="button" className={styles.bouton} aria-label={label} onClick={onClick}>
      <img className={styles.icone} src={icon} alt="" />
    </button>
  )
}
