/**
 * QUOI     — le sceau touché, posé à l'endroit du doigt : tant que l'énigme se charge il attend, puis
 *            il se retourne et montre l'icône de la culture (ou sa couleur, sans icône).
 * POURQUOI — maquette « Énigmes — 3 », sans la pluie d'éclats (UI sobre, `.claude/rules/interface.md`).
 * ATTENTION — mouvement réduit : pas de rotation, `onFini` dès que la culture est connue.
 */
import { useEffect } from 'react'
import type { Culture } from '../api/lireEnigmes'
import styles from './SceauQuiSeRetourne.module.css'

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function SceauQuiSeRetourne({
  x,
  y,
  culture,
  onFini,
}: {
  x: number
  y: number
  culture: Culture | null
  onFini: () => void
}) {
  useEffect(() => {
    if (culture && mouvementReduit()) onFini()
  }, [culture, onFini])

  return (
    <div
      className={styles.sceau}
      data-retourne={culture ? true : undefined}
      style={{ '--x': `${String(x)}px`, '--y': `${String(y)}px` }}
      aria-hidden="true"
      onAnimationEnd={onFini}
    >
      <span className={styles.face}>?</span>
      <span className={styles.dos} style={culture?.couleur ? { '--couleur-culture': culture.couleur } : undefined}>
        {culture?.icone ? <img src={culture.icone} alt="" /> : <span className={styles.pastille} />}
      </span>
    </div>
  )
}
