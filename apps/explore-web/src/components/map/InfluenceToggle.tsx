import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { CoupeRulesModal } from './CoupeRulesModal'
import './InfluenceToggle.css'

export function InfluenceToggle() {
  const factionColorMode = usePlayerStore(s => s.factionColorMode)
  const setFactionColorMode = usePlayerStore(s => s.setFactionColorMode)
  const [showRules, setShowRules] = useState(false)

  return (
    <>
      <div className="influence-toggle-wrap">
        <button className="influence-toggle" onClick={() => setFactionColorMode(!factionColorMode)}>
          <span className="influence-toggle-icon">{'⚔️'}</span>
          <span className="influence-toggle-label">{factionColorMode ? 'Héritages' : 'Coupe des Héritages'}</span>
          <span className={`influence-toggle-switch ${factionColorMode ? 'on' : ''}`} />
        </button>
        <button
          type="button"
          className="influence-toggle-info"
          onClick={(e) => { e.stopPropagation(); setShowRules(true) }}
          aria-label="Voir les règles de la Coupe des Héritages"
          title="Voir les règles"
        >
          {'ⓘ'}
        </button>
      </div>

      {showRules && <CoupeRulesModal onClose={() => setShowRules(false)} />}
    </>
  )
}
