import { useState } from 'react'
import { useCrownsStore } from '../../stores/crownsStore'
import { InfoModal } from './InfoModal'

/**
 * V0.7 phase 2 — Compteur de Couronnes de Chêne dans la toolbar.
 * Remplace InfluenceBadge (V0.5, gelé). Tooltip InfoModal au click, comme NotorietyBadge.
 *
 * La pulse `crowns-pop` se déclenche brièvement à chaque incrément de balance
 * pour signaler la récolte (déclenchée depuis le store via key change).
 */
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
        title="Couronnes de Chêne"
      >
        <span className="notoriety-icon" aria-hidden>{'🪙'}</span>
        <span
          className="notoriety-value crowns-value"
          // key change → re-anime à chaque récolte (le balance change → React re-mount le span)
          key={`balance-${balance}`}
        >
          {balance}
        </span>
      </div>

      {showInfo && (
        <InfoModal
          icon={'🪙'}
          title="Couronnes de Chêne"
          description="Récoltez chaque jour les Couronnes de Chêne sur les lieux que vous veillez. Un coffre apparaît toutes les 24h sur chaque lieu — cliquez pour ramasser. En solo : 1 Couronne par jour. En expédition (2 veilleurs ou plus) : 2 Couronnes par jour. Plafond personnel : 500."
          rows={[
            { label: 'Stock actuel', value: `${balance} / 500`, highlight: true },
            { label: 'Récolte solo', value: '+1 / jour / lieu' },
            { label: 'Récolte en expédition', value: '+2 / jour / lieu' },
            { label: 'À venir', value: 'Acheter des énigmes, déplacer son Campement' },
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
