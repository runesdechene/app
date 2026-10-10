/**
 * QUOI     — les quatre calendriers, chacun avec sa ligne d'explication : un seul se choisit.
 * POURQUOI — le même choix à l'onboarding et dans les Préférences (spec calendrier). De vrais
 *            boutons radio, comme `Segments` : clavier et lecteurs d'écran sans code maison.
 */
import { CALENDRIERS, type Calendrier } from '@runes/calendrier'
import { useId } from 'react'
import styles from './ChoixDuCalendrier.module.css'

export function ChoixDuCalendrier({
  valeur,
  onChange,
}: {
  valeur: Calendrier
  onChange: (calendrier: Calendrier) => void
}) {
  const nom = useId()
  return (
    <div className={styles.choix} role="radiogroup" aria-label="Ton calendrier">
      {CALENDRIERS.map((c) => (
        <label key={c.id} className={styles.option}>
          <input
            type="radio"
            name={nom}
            className={styles.radio}
            checked={c.id === valeur}
            onChange={() => {
              onChange(c.id)
            }}
          />
          <span className={styles.texte}>
            <span className={styles.libelle}>{c.libelle}</span>
            <span className={styles.explication}>{c.explication}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
