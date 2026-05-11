import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './VictoryModal.css'

interface Props {
  placeTitle: string
  /** True si le lieu était vacant (pas de veilleur précédent). */
  fromVacant: boolean
  /** Couleur de la nouvelle faction (pour l'accent visuel). */
  factionColor?: string | null
  /** Source du déclenchement, change label/icon/subline. Default 'taken_remote'. */
  mode?: 'taken_remote' | 'plant_gps' | 'reaffirm_gps'
  /** Gains affichés en bas (Gloire, Coupe, score Cour). Optionnels. */
  gloryGain?: number
  coupeGain?: number
  courBonus?: number
  /** Nombre de menaces effacées sur reaffirm_gps */
  threatsCleared?: number
  onClose: () => void
}

/**
 * V0.7.6 (8/05) — Pop-up "Victoire" qui s'affiche quand l'utilisateur a pris
 * un lieu par mécénat (event activity_log type='place_taken_remote_self').
 * V0.8.10 (11/05) — Étendue : sert aussi pour le plant_flag GPS et la
 * réaffirmation (Vigilance). Wording adapté via prop `mode`.
 * Pattern aligné sur LevelUpModal — teinte conquête (rouge bordeaux + or).
 */
export function VictoryModal({
  placeTitle, fromVacant, factionColor, mode = 'taken_remote',
  gloryGain, coupeGain, courBonus, threatsCleared,
  onClose,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const label = mode === 'reaffirm_gps' ? 'Vigilance' : 'Victoire'
  const icon = mode === 'reaffirm_gps' ? '🛡️' : '🏴'
  const subline = (() => {
    if (mode === 'reaffirm_gps') {
      const n = threatsCleared ?? 0
      if (n > 0) return `Tu as réduit à néant l'investissement des autres mécènes ! 💪 (${n} menace${n > 1 ? 's' : ''} effacée${n > 1 ? 's' : ''})`
      return 'Tu as réaffirmé ta présence sur ce lieu.'
    }
    if (mode === 'plant_gps') {
      return fromVacant
        ? 'Tu as planté ton étendard sur ce lieu vacant.'
        : 'Tu as planté ton étendard et pris ce lieu.'
    }
    // taken_remote (default)
    return fromVacant
      ? 'Tu as fait flotter ta bannière sur ce lieu vacant.'
      : 'Tu as repris ce lieu par la force du mécénat.'
  })()

  const hasGains = (gloryGain && gloryGain > 0)
                || (coupeGain && coupeGain > 0)
                || (courBonus && courBonus > 0)

  const node = (
    <div className="victory-overlay" onClick={onClose}>
      <div
        className="victory-modal"
        onClick={(e) => e.stopPropagation()}
        style={factionColor ? { '--victory-accent': factionColor } as React.CSSProperties : undefined}
      >
        <div className="victory-label">{label}</div>
        <div className="victory-icon" aria-hidden>{icon}</div>
        <div className="victory-place">{placeTitle}</div>
        <div className="victory-quote">{subline}</div>
        {hasGains && (
          <div className="victory-gains">
            {gloryGain !== undefined && gloryGain > 0 && (
              <span className="victory-gain">+{gloryGain} 🎖️ Gloire</span>
            )}
            {coupeGain !== undefined && coupeGain > 0 && (
              <span className="victory-gain">+{coupeGain} 🏆 Coupe des Héritages</span>
            )}
            {courBonus !== undefined && courBonus > 0 && (
              <span className="victory-gain">+{courBonus} ⚔️ score Cour</span>
            )}
          </div>
        )}
        <button className="victory-btn" onClick={onClose}>Continuer</button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
