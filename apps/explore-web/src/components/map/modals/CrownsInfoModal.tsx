import { useCrownsStore } from '../../../stores/crownsStore'
import { InfoModal } from './InfoModal'
import { isDemoMode } from '../../../lib/demo/isDemoMode'

interface Props {
  onClose: () => void
}

const TXT_TITLE       = 'Couronnes de Chêne'
const TXT_DESCRIPTION = "La monnaie du royaume. Tu en gagnes en récoltant les coffres qui poussent chaque jour sur tes lieux veillés, en sortant de nouveaux lieux du brouillard, et en résolvant des énigmes. Tu peux ensuite les investir en mécénat sur un lieu pour soutenir son veilleur ou y poser ta marque à distance — plus un lieu reçoit de Couronnes, plus il rayonne sur la carte."

/**
 * InfoModal Couronnes — source unique partagée entre CrownsBadge (carte
 * desktop) et StatsBar (home + carte mobile). Wording et rows extraits
 * depuis CrownsBadge.
 */
export function CrownsInfoModal({ onClose }: Props) {
  const balance = useCrownsStore(s => s.balance)

  return (
    <InfoModal
      icon={'🪙'}
      title={TXT_TITLE}
      description={TXT_DESCRIPTION}
      rows={[
        { label: 'Stock actuel', value: isDemoMode() ? '∞' : `${balance} / 500`, highlight: true },
        { label: 'Coffre aléatoire — lieu veillé seul', value: '+1 🪙' },
        { label: 'Coffre aléatoire — lieu veillé à plusieurs', value: '+2 🪙' },
        { label: 'Sortir un lieu du brouillard', value: '+1 🪙' },
        { label: '3 lieux découverts à distance / jour', value: '+1 🪙 bonus' },
        { label: 'Énigme résolue', value: '+1 à +3 🪙 selon la difficulté' },
      ]}
      onClose={onClose}
    />
  )
}
