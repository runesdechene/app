/**
 * QUOI     — le bouton qui fait avancer le parcours, collé en bas ; grisé, il dit ce qui manque.
 * POURQUOI — dans la V1, un bouton grisé ne disait jamais pourquoi : ici, la raison s'écrit
 *            juste au-dessus (« Il lui faut un nom »), sans erreur à chercher ailleurs.
 */
import styles from './BoutonSuivant.module.css'

export function BoutonSuivant({
  libelle,
  manque,
  enCours = false,
  onClick,
}: {
  libelle: string
  manque: string | null
  enCours?: boolean
  onClick: () => void
}) {
  return (
    <div className={styles.pied}>
      {manque && <p className={styles.manque}>{manque}</p>}
      <button
        type="button"
        className={styles.bouton}
        disabled={manque !== null || enCours}
        aria-busy={enCours || undefined}
        onClick={onClick}
      >
        {libelle}
      </button>
    </div>
  )
}
