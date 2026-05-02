import { useState } from 'react'
import { useCrownsStore } from '../../stores/crownsStore'
import { InfoModal } from './InfoModal'

// V0.7 phase 2 — Compteur de Couronnes de Chêne dans la toolbar.
// Toutes les chaînes UI utilisent les escapes Unicode (ê = ê, é = é,
// à = à, É = É, è = è) pour blinder contre les soucis
// d'encodage source / PWA cache observés par le passé.

const TXT_TITLE       = 'Couronnes de Chêne'
const TXT_DESCRIPTION = "Chaque jour, des coffres de Couronnes apparaissent sur certains des lieux que vous veillez. Si vous en veillez peu, ils en ont presque tous. Si vous en veillez beaucoup, l'algorithme tire au sort jusqu'à 15 lieux par jour — qui changent chaque matin — pour que vos meilleurs jours plafonnent autour de 15 à 30 Couronnes, mais que sur la durée tous vos lieux contribuent. Cliquez sur un coffre pour ramasser : +1 en solo, +2 en expédition. Plafond personnel : 500."
const TXT_ROW_DAILY   = 'Coffres par jour'
const TXT_ROW_DAILY_VAL = 'jusqu’à 15 lieux tirés au sort'
const TXT_ROW_SOLO    = 'Récolte solo'
const TXT_ROW_SOLO_VAL = '+1 Couronne par coffre'
const TXT_ROW_EXP     = 'Récolte en expédition (2 veilleurs ou +)'
const TXT_ROW_EXP_VAL = '+2 Couronnes par coffre'
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
            { label: TXT_ROW_DAILY, value: TXT_ROW_DAILY_VAL },
            { label: TXT_ROW_SOLO, value: TXT_ROW_SOLO_VAL },
            { label: TXT_ROW_EXP, value: TXT_ROW_EXP_VAL },
            { label: TXT_ROW_FUTURE, value: TXT_ROW_FUTURE_VAL },
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
