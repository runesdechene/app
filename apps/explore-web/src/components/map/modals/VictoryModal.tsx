import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './VictoryModal.css'

interface Props {
  placeTitle: string
  /** True si le lieu était vacant (pas de veilleur précédent). */
  fromVacant: boolean
  /** Couleur de la nouvelle faction (pour l'accent visuel). */
  factionColor?: string | null
  onClose: () => void
}

/**
 * V0.7.6 (8/05) — Pop-up "Victoire" qui s'affiche quand l'utilisateur a pris
 * un lieu par mécénat (event activity_log type='place_taken_remote_self').
 * Pattern aligné sur LevelUpModal — teinte conquête (rouge bordeaux + or).
 */
export function VictoryModal({ placeTitle, fromVacant, factionColor, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const subline = fromVacant
    ? 'Tu as fait flotter ta bannière sur ce lieu vacant.'
    : 'Tu as repris ce lieu par la force du mécénat.'

  const node = (
    <div className="victory-overlay" onClick={onClose}>
      <div
        className="victory-modal"
        onClick={(e) => e.stopPropagation()}
        style={factionColor ? { '--victory-accent': factionColor } as React.CSSProperties : undefined}
      >
        <div className="victory-label">Victoire</div>
        <div className="victory-icon" aria-hidden>🏴</div>
        <div className="victory-place">{placeTitle}</div>
        <div className="victory-quote">{subline}</div>
        <button className="victory-btn" onClick={onClose}>Continuer</button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
