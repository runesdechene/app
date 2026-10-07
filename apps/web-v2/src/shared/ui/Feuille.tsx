/**
 * QUOI     — la feuille qui monte du bas de l'écran (menu avatar, explications courtes).
 * POURQUOI — maquette « Menu Avatar » : un panneau crème sur un voile, sans titre visible. Le
 *            titre nomme la boîte de dialogue pour les lecteurs d'écran. Le voile et Échap
 *            ferment ; le focus entre dans la feuille à l'ouverture.
 * ATTENTION — sous une `RacineDesFeuilles` (la coquille la pose), la feuille s'y rend par un
 *            portail : ouverte depuis le tiroir d'une fiche, son voile couvre quand même toute
 *            l'app. Sans racine (les faux téléphones de /da), elle reste où elle est.
 */
import { useContext, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Feuille.module.css'
import { RacineDesFeuilles } from './racineDesFeuilles'

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
  const racine = useContext(RacineDesFeuilles)

  // Le focus entre une seule fois, à l'ouverture ; la touche Échap suit `onFermer`.
  useEffect(() => {
    panneau.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
    }
  }, [onFermer])

  const feuille = (
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
  return racine ? createPortal(feuille, racine) : feuille
}
