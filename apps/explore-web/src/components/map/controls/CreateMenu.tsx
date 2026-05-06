import { useEffect } from 'react'
import './CreateMenu.css'

/**
 * Menu pop-up au-dessus du bouton FAB "+" en bas-gauche.
 * Deux options : Ajouter un lieu / Créer une expédition.
 */

interface Props {
  canAddPlace: boolean
  discoveriesNeeded: number
  onAddPlace: () => void
  onAddPlaceLocked: () => void
  onCreateExpedition: () => void
  onClose: () => void
}

export function CreateMenu({
  canAddPlace,
  discoveriesNeeded,
  onAddPlace,
  onAddPlaceLocked,
  onCreateExpedition,
  onClose,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="create-menu-overlay" onClick={onClose}>
      <div className="create-menu" onClick={(e) => e.stopPropagation()}>
        <div className="create-menu-eyebrow">Que veux-tu créer ?</div>

        <button
          className={`create-menu-option${!canAddPlace ? ' is-locked' : ''}`}
          onClick={() => {
            if (canAddPlace) onAddPlace()
            else onAddPlaceLocked()
          }}
        >
          <span className="create-menu-icon">{canAddPlace ? '🗺️' : '🔒'}</span>
          <div className="create-menu-text">
            <div className="create-menu-title">Ajouter un lieu</div>
            <div className="create-menu-help">
              {canAddPlace
                ? 'Cartographier un lieu pour la communauté'
                : `Découvre encore ${discoveriesNeeded} lieu${discoveriesNeeded > 1 ? 'x' : ''}`}
            </div>
          </div>
        </button>

        <button
          className="create-menu-option"
          onClick={onCreateExpedition}
        >
          <span className="create-menu-icon">🚩</span>
          <div className="create-menu-text">
            <div className="create-menu-title">Créer une expédition</div>
            <div className="create-menu-help">Convoquer des compagnons pour partir ensemble</div>
          </div>
        </button>
      </div>
    </div>
  )
}
