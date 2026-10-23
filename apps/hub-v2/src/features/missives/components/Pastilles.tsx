/**
 * QUOI     — un choix en pastilles qui passent à la ligne (palettes, listes, quand), maquette 753:2529.
 * POURQUOI — des boutons radio natifs, comme ChoixSegmente, mais chaque option est sa propre pastille :
 *            la colonne des réglages est étroite et les options nombreuses.
 */
import styles from './Ecrire.module.css'

export function Pastilles<T extends string>({ nom, options, choisi, onChoix }: {
  nom: string
  options: { valeur: T; libelle: string; detail?: string }[]
  choisi: T | null
  onChoix: (valeur: T) => void
}) {
  return (
    <fieldset className={styles.pastilles}>
      <legend className={styles.rubrique}>{nom}</legend>
      {options.map((o) => (
        <label key={o.valeur} className={styles.pastille}>
          <input
            type="radio"
            name={nom}
            checked={o.valeur === choisi}
            onChange={() => {
              onChoix(o.valeur)
            }}
          />
          <span className={styles.pastilleTexte}>
            {o.libelle}
            {o.detail && <span className={styles.compte}> {o.detail}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
