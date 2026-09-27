/**
 * QUOI     — l'interrupteur des Préférences : allumé en rouge, éteint en sable.
 * POURQUOI — un bouton `role="switch"` : le lecteur d'écran annonce « activé / désactivé ». Le
 *            libellé visible vit dans la carte à côté ; ici il nomme le switch pour l'accessibilité.
 */
import styles from './Interrupteur.module.css'

export function Interrupteur({
  libelle,
  actif,
  onChange,
  desactive = false,
}: {
  libelle: string
  actif: boolean
  onChange: (valeur: boolean) => void
  desactive?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={desactive}
      className={styles.interrupteur}
      onClick={() => {
        onChange(!actif)
      }}
    >
      <span className={styles.bouton} />
    </button>
  )
}
