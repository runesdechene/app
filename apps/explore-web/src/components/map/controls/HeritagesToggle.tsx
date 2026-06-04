import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { CoupeRulesModal } from '../modals/CoupeRulesModal'
import './HeritagesToggle.css'

// Anciennement InfluenceToggle (V0.5). Renommé V0.7 phase 5.
// NB : les classes CSS .influence-toggle-* + .influence-area sont conservées
// pour cohérence avec les autres règles CSS du projet. Le fichier
// HeritagesToggle.css contient aussi les règles .minimap et .conquest-indicator
// (regroupement historique — à éclater plus tard).
export function HeritagesToggle() {
  const factionColorMode = usePlayerStore(s => s.factionColorMode)
  const setFactionColorMode = usePlayerStore(s => s.setFactionColorMode)
  const [showRules, setShowRules] = useState(false)

  return (
    <>
      <div className="influence-toggle-wrap">
        <button className="influence-toggle" onClick={() => setFactionColorMode(!factionColorMode)}>
          <span className="influence-toggle-icon">{'⚔️'}</span>
          <span className="influence-toggle-label">Factions</span>
          <span className={`influence-toggle-switch ${factionColorMode ? 'on' : ''}`} />
        </button>
        <button
          type="button"
          className="influence-toggle-info"
          onClick={(e) => { e.stopPropagation(); setShowRules(true) }}
          aria-label="Voir les règles de la Coupe des Factions"
          title="Voir les règles"
        >
          {'ⓘ'}
        </button>
      </div>

      {showRules && <CoupeRulesModal onClose={() => setShowRules(false)} />}
    </>
  )
}
