import { useState } from 'react'
import { useCrownsStore } from '../../../stores/crownsStore'
import { InfoModal } from '../modals/InfoModal'

// V0.7 phase 2 — Compteur de Couronnes de Chêne dans la toolbar.
// Toutes les chaînes UI utilisent les escapes Unicode (ê = ê, é = é,
// à = à, É = É, è = è) pour blinder contre les soucis
// d'encodage source / PWA cache observés par le passé.

const TXT_TITLE       = 'Couronnes de Chêne'
const TXT_DESCRIPTION = "La monnaie du royaume. Tu en gagnes en récoltant les coffres qui poussent chaque jour sur tes lieux veillés, en sortant de nouveaux lieux du brouillard, et en résolvant des énigmes. Tu peux ensuite les investir en mécénat sur un lieu pour soutenir son veilleur ou y poser ta marque à distance — plus un lieu reçoit de Couronnes, plus il rayonne sur la carte."
const TXT_ROW_SOLO    = 'Coffre — lieu veillé seul'
const TXT_ROW_SOLO_VAL = '+1 🪙'
const TXT_ROW_EXP     = 'Coffre — lieu veillé à plusieurs'
const TXT_ROW_EXP_VAL = '+2 🪙'
const TXT_ROW_DISCOVER = 'Sortir un lieu du brouillard'
const TXT_ROW_DISCOVER_VAL = '+1 🪙'
const TXT_ROW_QUEST   = '3 lieux découverts à distance / jour'
const TXT_ROW_QUEST_VAL = '+1 🪙 bonus'
const TXT_ROW_ENIGMA  = 'Énigme résolue'
const TXT_ROW_ENIGMA_VAL = '+1 à +3 🪙 selon la difficulté'

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
            { label: TXT_ROW_SOLO, value: TXT_ROW_SOLO_VAL },
            { label: TXT_ROW_EXP, value: TXT_ROW_EXP_VAL },
            { label: TXT_ROW_DISCOVER, value: TXT_ROW_DISCOVER_VAL },
            { label: TXT_ROW_QUEST, value: TXT_ROW_QUEST_VAL },
            { label: TXT_ROW_ENIGMA, value: TXT_ROW_ENIGMA_VAL },
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
