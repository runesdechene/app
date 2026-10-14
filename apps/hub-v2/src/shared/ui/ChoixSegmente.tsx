/**
 * QUOI     — une gélule au contour fin, le choix actif en rouge (période, filtres).
 * POURQUOI — des boutons radio natifs : le clavier et les lecteurs d'écran marchent sans code.
 */
import styles from './ChoixSegmente.module.css'

type Option<T extends string> = { valeur: T; libelle: string }

export function ChoixSegmente<T extends string>({
  options, choisi, onChoix, nom,
}: { options: Option<T>[]; choisi: T; onChoix: (valeur: T) => void; nom: string }) {
  return (
    <fieldset className={styles.choix}>
      <legend className={styles.legende}>{nom}</legend>
      {options.map((o) => (
        <label key={o.valeur} className={styles.option}>
          <input
            type="radio"
            name={nom}
            value={o.valeur}
            checked={o.valeur === choisi}
            onChange={() => { onChoix(o.valeur) }}
          />
          <span>{o.libelle}</span>
        </label>
      ))}
    </fieldset>
  )
}
