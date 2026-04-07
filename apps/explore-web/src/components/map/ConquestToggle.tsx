import { usePlayerStore } from '../../stores/playerStore'
import './ConquestToggle.css'

export function ConquestToggle() {
  const factionColorMode = usePlayerStore(s => s.factionColorMode)
  const setFactionColorMode = usePlayerStore(s => s.setFactionColorMode)

  return (
    <button className="conquest-toggle" onClick={() => setFactionColorMode(!factionColorMode)}>
      <span className="conquest-toggle-icon">{'\u2694\uFE0F'}</span>
      <span className="conquest-toggle-label">Coupe des Héritages</span>
      <span className={`conquest-toggle-switch ${factionColorMode ? 'on' : ''}`} />
    </button>
  )
}
