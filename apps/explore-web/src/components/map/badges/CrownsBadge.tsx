import { useState } from 'react'
import { useCrownsStore } from '../../../stores/crownsStore'
import { CrownsInfoModal } from '../modals/CrownsInfoModal'

// V0.7 phase 2 — Compteur de Couronnes de Chêne dans la toolbar.
// L'InfoModal est extraite dans CrownsInfoModal pour partage avec StatsBar
// (home + carte mobile) — source unique du wording / barème.

export function CrownsBadge() {
  const balance = useCrownsStore(s => s.balance)
  const capped = useCrownsStore(s => s.capped)
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <div
        className={`notoriety-badge crowns-badge${capped ? ' capped' : ''}`}
        onClick={(e) => { e.stopPropagation(); setShowInfo(true) }}
        style={{ cursor: 'pointer' }}
        title={'Couronnes de Chêne'}
      >
        <span className="notoriety-icon" aria-hidden>{'🪙'}</span>
        <span
          className="notoriety-value crowns-value"
          key={`balance-${balance}`}
        >
          {balance}
        </span>
      </div>

      {showInfo && <CrownsInfoModal onClose={() => setShowInfo(false)} />}
    </>
  )
}
