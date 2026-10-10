/**
 * QUOI     — le bouton du sablier : il ouvre et referme la frise des époques, sur la carte.
 * POURQUOI — même carré que le bouton Filtre ; à l'encre tant que la frise est ouverte ou qu'une
 *            plage est choisie, pour qu'on n'oublie pas que des lieux sont cachés.
 * ATTENTION — son nom reste « Frise des époques » dans les deux états : l'état se lit sur
 *            `aria-expanded` et `data-actif`.
 */
import styles from './CarteScreen.module.css'

export function Sablier({
  ouvert,
  actif,
  onBasculer,
}: {
  ouvert: boolean
  actif: boolean
  onBasculer: () => void
}) {
  return (
    <button
      type="button"
      className={styles.sablier}
      aria-label="Frise des époques"
      aria-expanded={ouvert}
      data-actif={actif || undefined}
      onClick={onBasculer}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 2h12M4 18h12M5.5 2v3l4.5 5-4.5 5v3M14.5 2v3L10 10l4.5 5v3" />
      </svg>
    </button>
  )
}
