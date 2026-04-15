import { usePlayerStore } from '../../stores/playerStore'
import './InfluenceToggle.css'

export function InfluenceToggle() {
  const factionColorMode = usePlayerStore(s => s.factionColorMode)
  const setFactionColorMode = usePlayerStore(s => s.setFactionColorMode)

  return (
    <button className="influence-toggle" onClick={() => setFactionColorMode(!factionColorMode)}>
      <span className="influence-toggle-icon">{'\u2694\uFE0F'}</span>
      <span className="influence-toggle-label">Coupe des Héritages</span>
      <span className={`influence-toggle-switch ${factionColorMode ? 'on' : ''}`} />
    </button>
  )
}
