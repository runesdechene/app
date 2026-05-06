import { useState } from 'react'
import { useVoronoiTuningStore, radiusForCrowns } from '../../../stores/voronoiTuningStore'
import './VoronoiTuningPanel.css'

const REFERENCE_VALUES = [0, 1, 5, 20, 100, 500, 1000, 10000]

export function VoronoiTuningPanel() {
  const enabled = useVoronoiTuningStore(s => s.enabled)
  const baseKm = useVoronoiTuningStore(s => s.baseKm)
  const stepKm = useVoronoiTuningStore(s => s.stepKm)
  const capKm = useVoronoiTuningStore(s => s.capKm)
  const setEnabled = useVoronoiTuningStore(s => s.setEnabled)
  const setBaseKm = useVoronoiTuningStore(s => s.setBaseKm)
  const setStepKm = useVoronoiTuningStore(s => s.setStepKm)
  const setCapKm = useVoronoiTuningStore(s => s.setCapKm)
  const crownsByPlace = useVoronoiTuningStore(s => s.crownsByPlace)
  const reset = useVoronoiTuningStore(s => s.reset)

  const [collapsed, setCollapsed] = useState(true)
  const loadedCount = crownsByPlace.size

  if (collapsed) {
    return (
      <button
        className="voronoi-tuning-fab"
        onClick={() => setCollapsed(false)}
        title="Voronoï pondéré (admin)"
      >
        🛠
      </button>
    )
  }

  return (
    <div className="voronoi-tuning-panel">
      <div className="vtp-header">
        <span className="vtp-title">🛠 Voronoï pondéré</span>
        <button className="vtp-close" onClick={() => setCollapsed(true)}>✕</button>
      </div>

      <label className="vtp-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
        />
        Activer la pondération
      </label>

      <div className={`vtp-body${enabled ? '' : ' disabled'}`}>
        <div className="vtp-row">
          <label>Base (km)</label>
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={baseKm}
            onChange={e => setBaseKm(Number(e.target.value))}
          />
          <span className="vtp-value">{baseKm.toFixed(1)}</span>
        </div>

        <div className="vtp-row">
          <label>Step log</label>
          <input
            type="range"
            min={0.05}
            max={3.0}
            step={0.05}
            value={stepKm}
            onChange={e => setStepKm(Number(e.target.value))}
          />
          <span className="vtp-value">{stepKm.toFixed(2)}</span>
        </div>

        <div className="vtp-row">
          <label>Cap max</label>
          <input
            type="range"
            min={1}
            max={30}
            step={0.5}
            value={capKm}
            onChange={e => setCapKm(Number(e.target.value))}
          />
          <span className="vtp-value">{capKm.toFixed(1)}</span>
        </div>

        <table className="vtp-reference">
          <thead>
            <tr>
              <th>Couronnes</th>
              <th>Rayon</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCE_VALUES.map(c => (
              <tr key={c}>
                <td>{c.toLocaleString('fr-FR')}</td>
                <td>{radiusForCrowns(c, baseKm, stepKm, capKm).toFixed(2)} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vtp-footer">
        <span className="vtp-loaded">
          {loadedCount === 0 ? 'Chargement…' : `${loadedCount} lieu${loadedCount > 1 ? 'x' : ''} avec Couronnes`}
        </span>
        <button className="vtp-reset" onClick={reset}>Réinitialiser</button>
      </div>
    </div>
  )
}
