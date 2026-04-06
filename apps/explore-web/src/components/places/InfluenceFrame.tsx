import { usePlayerStore } from '../../stores/playerStore'
import './InfluenceFrame.css'

interface InfluenceEntry {
  factionId: string
  placed: number
  content: number
  total: number
}

interface InfluenceFrameProps {
  placeId: string
  influence: InfluenceEntry[]
  factionColors: Map<string, string>
  placeLocation: { latitude: number; longitude: number }
  onInfluencePlaced: () => void
}

export function InfluenceFrame({ placeId, influence, factionColors, placeLocation, onInfluencePlaced }: InfluenceFrameProps) {
  const influenceStock = usePlayerStore(s => s.influenceStock)
  const userId = usePlayerStore(s => s.userId)
  const gameMode = usePlayerStore(s => s.gameMode)

  if (gameMode !== 'conquest') return null

  // Find dominant faction
  const sorted = [...influence].sort((a, b) => b.total - a.total)
  const dominantId = sorted[0]?.factionId

  return (
    <div className="influence-frame">
      <div className="influence-frame-title">Influence des Héritages</div>

      {influence.length > 0 ? (
        <div className="influence-flags">
          {sorted.map(entry => (
            <span
              key={entry.factionId}
              className="influence-flag"
              style={{ backgroundColor: factionColors.get(entry.factionId) ?? '#8a7a6a' }}
            >
              {entry.total}
              {entry.factionId === dominantId && ' ⭐'}
            </span>
          ))}
        </div>
      ) : (
        <p className="influence-empty">Aucune faction n'a encore posé son empreinte ici.</p>
      )}

      {userId && (
        <>
          <button
            className="influence-cta"
            onClick={() => {
              // Delegate to InfluenceButton logic — will be wired in PlacePanel
              const event = new CustomEvent('open-influence-action', {
                detail: { placeId, placeLocation },
              })
              window.dispatchEvent(event)
            }}
          >
            🏰 Placer de l'influence
          </button>
          <div className="influence-stock-label">
            Ton stock : {influenceStock} point{influenceStock !== 1 ? 's' : ''} disponible{influenceStock !== 1 ? 's' : ''}
          </div>
        </>
      )}
    </div>
  )
}
