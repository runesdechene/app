/**
 * QUOI     — un choix exclusif en segments (« Masculin — Chevalier » / « Féminin — Chevalière »,
 *            maquette 91:107) : la zone éclairée glisse sous le segment choisi.
 * POURQUOI — de vrais boutons radio, cachés sous leur libellé : le clavier (flèches), les
 *            lecteurs d'écran et le formulaire marchent sans code maison. La zone éclairée est
 *            un seul élément, déplacé en CSS selon le rang du choix (`--rang`).
 * ATTENTION — le glissement se coupe quand le système demande moins d'animations.
 */
import { useId } from 'react'
import styles from './Segments.module.css'

export function Segments<T extends string>({
  libelle,
  options,
  valeur,
  onChange,
}: {
  libelle: string
  options: readonly { id: T; libelle: string }[]
  valeur: T
  onChange: (valeur: T) => void
}) {
  const nom = useId()
  const rang = options.findIndex((o) => o.id === valeur)

  return (
    <div
      className={styles.segments}
      role="radiogroup"
      aria-label={libelle}
      style={{ '--nombre': String(options.length), '--rang': String(rang) }}
    >
      <span className={styles.curseur} aria-hidden="true" />
      {options.map((o) => (
        <label key={o.id} className={styles.segment}>
          <input
            type="radio"
            name={nom}
            className={styles.radio}
            checked={o.id === valeur}
            onChange={() => {
              onChange(o.id)
            }}
          />
          {o.libelle}
        </label>
      ))}
    </div>
  )
}
