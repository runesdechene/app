/**
 * QUOI     — la feuille qui monte du bas de l'écran (menu avatar, explications courtes).
 * POURQUOI — maquette « Menu Avatar » : un panneau crème sur un voile, sans titre visible. Le
 *            titre nomme la boîte de dialogue pour les lecteurs d'écran. Le voile et Échap
 *            ferment ; le focus entre dans la feuille à l'ouverture.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Feuille.module.css'

export function Feuille({
  titre,
  onFermer,
  children,
}: {
  titre: string
  onFermer: () => void
  children: ReactNode
}) {
  const panneau = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panneau.current?.focus({ preventScroll: true })
    function surTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
    }
  }, [onFermer])

  return (
    <div className={styles.feuille}>
      <div className={styles.voile} data-testid="voile" onClick={onFermer} />
      <div
        ref={panneau}
        className={styles.panneau}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        tabIndex={-1}
      >
        <span className={styles.poignee} />
        {children}
      </div>
    </div>
  )
}
