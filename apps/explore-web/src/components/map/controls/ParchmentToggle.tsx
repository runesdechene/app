import './ParchmentToggle.css'
import { useMapStore } from '../../../stores/mapStore'

export function ParchmentToggle() {
  const parchmentMode = useMapStore(s => s.parchmentMode)
  const setParchmentMode = useMapStore(s => s.setParchmentMode)

  return (
    <div
      className={`parchment-toggle${parchmentMode ? ' parchment-toggle--on' : ''}`}
      onClick={() => setParchmentMode(!parchmentMode)}
      title={parchmentMode ? 'Mode parchemin activé' : 'Mode parchemin désactivé'}
    >
      <span className="parchment-toggle__icon">📜</span>
      <div className="parchment-toggle__switch">
        <div className="parchment-toggle__knob" />
      </div>
    </div>
  )
}
