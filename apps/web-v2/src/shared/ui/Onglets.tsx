/**
 * QUOI     — une rangée d'onglets en Bebas Neue, trait sous l'onglet actif (maquette Compte :
 *            « Ajoutés 2 — Visités 18 — Envie d'y aller »).
 * POURQUOI — générique sur l'identifiant (`T`) : l'écran garde ses propres noms d'onglets typés.
 */
import styles from './Onglets.module.css'

export function Onglets<T extends string>({
  onglets,
  actif,
  onChange,
}: {
  onglets: readonly { id: T; libelle: string; compte?: number }[]
  actif: T
  onChange: (id: T) => void
}) {
  return (
    <div className={styles.onglets} role="tablist">
      {onglets.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === actif}
          className={styles.onglet}
          onClick={() => {
            onChange(o.id)
          }}
        >
          <span className={styles.libelle}>
            {o.libelle}
            {o.compte !== undefined && <span className={styles.compte}>{o.compte}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
