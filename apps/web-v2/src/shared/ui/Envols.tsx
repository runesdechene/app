/**
 * QUOI     — les cœurs qui s'envolent d'un bouton, un par toucher : `useEnvols`
 *            (shared/hooks) les compte, `Envols` les dessine ; chacun disparaît à la fin de son envol.
 * POURQUOI — Uriel, 28/09 (les saluts) puis 30/09 (aimer un lieu) : « addictif » — une rafale
 *            devient une armée de cœurs.
 * ATTENTION — le bouton qui les porte est en `position: relative` : ils partent de son coin haut
 *            gauche (`[data-envol]` se déplace depuis le CSS du bouton si besoin).
 */
import styles from './Envols.module.css'

export function Envols({ envols, onFin }: { envols: number[]; onFin: (n: number) => void }) {
  return envols.map((n) => (
    <span
      key={n}
      className={styles.envol}
      data-envol
      aria-hidden="true"
      onAnimationEnd={() => {
        onFin(n)
      }}
    />
  ))
}
