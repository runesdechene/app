/**
 * QUOI     — le sceau « ? » touché, posé à l'endroit du doigt : tant que l'énigme se charge il attend,
 *            puis il se retourne sur un cachet de cire à la couleur et au logo de la culture (ou à son
 *            initiale, sans logo).
 * POURQUOI — Uriel, 07/10 : le sceau de la carte, puis le cachet de la culture. Sans pluie d'éclats
 *            (UI sobre, `.claude/rules/interface.md`).
 * ATTENTION — mouvement réduit : pas de rotation, `onFini` dès que la culture est connue.
 */
import { useEffect } from 'react'
import type { Culture } from '../api/lireEnigmes'
import { BORD_DE_CIRE } from '../lib/cachet'
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
      <span className={styles.face}>
        <Cire />
        <span className={styles.point}>?</span>
      </span>
      <span className={styles.dos} style={culture?.couleur ? { '--couleur-culture': culture.couleur } : undefined}>
        <Cire />
        <span className={styles.coeur}>
          {culture?.icone ? <img src={culture.icone} alt="" /> : culture?.nom.charAt(0)}
        </span>
      </span>
    </div>
  )
}

// La cire des deux faces : le bord irrégulier et l'anneau où la matrice a pressé.
function Cire() {
  return (
    <svg className={styles.cire} viewBox="0 0 96 96">
      <path d={BORD_DE_CIRE} />
      <circle cx="48" cy="48" r="31" />
    </svg>
  )
}
