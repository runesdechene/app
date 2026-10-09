/**
 * QUOI     — « ● 7 actifs », à côté de la jauge d'énergie (maquette 362:182) : les Explorateurs en
 *            ligne ou passés dans l'heure. Le toucher ouvre la liste.
 * POURQUOI — Uriel, 01/10 : « actifs », pas « en ligne » — la carte vit aussi de ceux qui viennent
 *            de passer. Personne : rien.
 */
import styles from './CompteurActifs.module.css'

export function CompteurActifs({ nombre, onOuvrir }: { nombre: number; onOuvrir: () => void }) {
  if (nombre === 0) return null
  return (
    <button
      type="button"
      className={styles.compteur}
      aria-label={`${String(nombre)} ${nombre === 1 ? 'actif' : 'actifs'}`}
      onClick={onOuvrir}
    >
      <span className={styles.point} aria-hidden="true" />
      <strong className={styles.nombre}>{nombre}</strong>
      <span className={styles.libelle}>{nombre === 1 ? 'actif' : 'actifs'}</span>
    </button>
  )
}
