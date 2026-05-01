import { useState } from 'react'
import { useCrownsStore } from '../../stores/crownsStore'
import { InfoModal } from './InfoModal'

// V0.7 phase 2 — Compteur de Couronnes de Chêne dans la toolbar.
// Toutes les chaînes UI utilisent les escapes Unicode (ê = ê, é = é,
// à = à, É = É, è = è) pour blinder contre les soucis
// d'encodage source / PWA cache observés par le passé.

const TXT_TITLE       = 'Couronnes de Chêne'
const TXT_DESCRIPTION = 'Récoltez chaque jour les Couronnes de Chêne sur les lieux que vous veillez. Un coffre apparaît toutes les 24h sur chaque lieu — cliquez pour ramasser. En solo : 1 Couronne par jour. En expédition (2 veilleurs ou plus) : 2 Couronnes par jour. Plafond personnel : 500.'
const TXT_ROW_SOLO    = 'Récolte solo'
const TXT_ROW_EXP     = 'Récolte en expédition'
const TXT_ROW_FUTURE  = 'À venir'
const TXT_ROW_FUTURE_VAL = 'Acheter des énigmes, déplacer son Campement'

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
        title={TXT_TITLE}
      >
        <span className="notoriety-icon" aria-hidden>{'🪙'}</span>
        <span
          className="notoriety-value crowns-value"
          key={`balance-${balance}`}
        >
          {balance}
        </span>
      </div>

      {showInfo && (
        <InfoModal
          icon={'🪙'}
          title={TXT_TITLE}
          description={TXT_DESCRIPTION}
          rows={[
            { label: 'Stock actuel', value: `${balance} / 500`, highlight: true },
            { label: TXT_ROW_SOLO, value: '+1 / jour / lieu' },
            { label: TXT_ROW_EXP, value: '+2 / jour / lieu' },
            { label: TXT_ROW_FUTURE, value: TXT_ROW_FUTURE_VAL },
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
