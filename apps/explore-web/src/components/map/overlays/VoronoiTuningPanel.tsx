import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useVoronoiTuningStore, radiusForCrowns } from '../../../stores/voronoiTuningStore'
import './VoronoiTuningPanel.css'

interface CourtInvestedRow {
  placeId: string
  crownsTotal: number
}

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
  const setCrownsByPlace = useVoronoiTuningStore(s => s.setCrownsByPlace)
  const reset = useVoronoiTuningStore(s => s.reset)

  const [collapsed, setCollapsed] = useState(true)
  const [loadedCount, setLoadedCount] = useState<number | null>(null)

  // Charge les Couronnes investies par lieu au mount
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc('get_court_invested_per_place')
      if (error) {
        console.error('[VoronoiTuningPanel] error', error)
        return
      }
      const rows = (data as CourtInvestedRow[]) ?? []
      const map = new Map<string, number>()
      for (const r of rows) map.set(r.placeId, r.crownsTotal)
      setCrownsByPlace(map)
      setLoadedCount(rows.length)
    })()
  }, [setCrownsByPlace])

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
            min={0.3}
            max={2.0}
            step={0.05}
            value={baseKm}
            onChange={e => setBaseKm(Number(e.target.value))}
          />
          <span className="vtp-value">{baseKm.toFixed(2)}</span>
        </div>

        <div className="vtp-row">
          <label>Step log</label>
          <input
            type="range"
            min={0.05}
            max={1.0}
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
            min={1.5}
            max={5.0}
            step={0.1}
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
          {loadedCount === null ? 'Chargement…' : `${loadedCount} lieu${loadedCount > 1 ? 'x' : ''} avec Couronnes`}
        </span>
        <button className="vtp-reset" onClick={reset}>Réinitialiser</button>
      </div>
    </div>
  )
}
