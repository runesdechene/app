import { useMapStore } from '../../stores/mapStore'

interface Props {
  placeId: string
  baseScore: number
}

export function ScoreSlider({ placeId, baseScore }: Props) {
  const setPlaceOverride = useMapStore(s => s.setPlaceOverride)
  const override = useMapStore(s => s.placeOverrides.get(placeId))
  const score = override?.score ?? baseScore

  return (
    <div style={{ margin: '12px 0', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: 0.7 }}>
        Score (influence) : <strong>{score}</strong>
        <input
          type="range"
          min={0}
          max={200}
          value={score}
          onChange={e => setPlaceOverride(placeId, { score: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
      </label>
    </div>
  )
}
