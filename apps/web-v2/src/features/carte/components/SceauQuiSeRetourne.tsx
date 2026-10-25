/**
 * QUOI     — le sceau touché, posé sur celui de la carte (la cire à la couleur de la culture, la clé
 *            d'or) : il pivote sur lui-même tant que l'énigme se charge, puis s'efface en grandissant
 *            pendant que la feuille s'ouvre.
 * POURQUOI — Uriel, 25/10 : le même sceau que sur la carte, qui pivote puis disparaît en s'ouvrant.
 *            Sans pluie d'éclats (UI sobre, `.claude/rules/interface.md`).
 * ATTENTION — il finit toujours son tour avant de partir : `onOuvrir` tombe à la fin d'un tour.
 *            Mouvement réduit : ni tour ni effacement, la feuille s'ouvre dès l'énigme chargée.
 */
import { useEffect, useState } from 'react'
import imageCire from '@/assets/ui/enigme-cire.png'
import imageCle from '@/assets/ui/enigme-cle.png'
import styles from './SceauQuiSeRetourne.module.css'

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function SceauQuiSeRetourne({
  x,
  y,
  couleur,
  prete,
  onOuvrir,
  onFini,
}: {
  x: number
  y: number
  couleur: string | null
  prete: boolean
  onOuvrir: () => void
  onFini: () => void
}) {
  const [part, setPart] = useState(false)

  useEffect(() => {
    if (prete && mouvementReduit()) {
      onOuvrir()
      onFini()
    }
  }, [prete, onOuvrir, onFini])

  return (
    <div
      className={styles.sceau}
      data-prete={prete ? true : undefined}
      data-part={part ? true : undefined}
      style={{
        '--x': `${String(x)}px`,
        '--y': `${String(y)}px`,
        '--icone': `url("${imageCire}")`,
        ...(couleur && { '--couleur-culture': couleur }),
      }}
      aria-hidden="true"
      onAnimationIteration={() => {
        if (!prete) return
        setPart(true)
        onOuvrir()
      }}
      onAnimationEnd={onFini}
    >
      <img className={styles.calque} src={imageCire} alt="" />
      {couleur && <span className={styles.teinte} />}
      <img className={styles.calque} src={imageCle} alt="" />
    </div>
  )
}
