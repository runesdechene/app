import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { InfoModal } from './InfoModal'

export function InfluenceBadge() {
  const influenceStock = usePlayerStore(s => s.influenceStock)
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <div
        className="notoriety-badge"
        onClick={() => setShowInfo(true)}
        style={{ cursor: 'pointer' }}
      >
        <span className="notoriety-icon">{'\uD83C\uDFF4'}</span>
        <span className="notoriety-value">{influenceStock}</span>
      </div>

      {showInfo && (
        <InfoModal
          icon={'\uD83C\uDFF4'}
          title="Influence"
          description="Points d'influence a placer sur les lieux pour soutenir votre Heritage. Gagnez-en en repondant aux enigmes, en ajoutant des carnets et des photos."
          rows={[
            { label: 'Stock a placer', value: `${influenceStock} pts`, highlight: true },
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
