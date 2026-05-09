import { usePlayerStore } from '../../../stores/playerStore'
import { useFractionalEnergy, formatEnergy } from '../../../hooks/useFractionalEnergy'
import { InfoModal } from './InfoModal'

interface Props {
  onClose: () => void
}

/**
 * InfoModal Énergie — source unique partagée entre EnergyIndicator (carte
 * desktop) et StatsBar (home + carte mobile). Wording et rows extraits
 * depuis EnergyIndicator (y compris bonus regen faction conditionnel).
 */
export function EnergyInfoModal({ onClose }: Props) {
  const cycleSeconds = usePlayerStore(s => s.energyCycle)
  const { energy, maxEnergy, ratePerHour } = useFractionalEnergy()

  const baseCycle = 7200
  const baseRate = 3600 / baseCycle
  const hasRegenBonus = cycleSeconds !== baseCycle

  return (
    <InfoModal
      icon={'⚡'}
      title="Energie"
      description="L'energie permet de decouvrir et proteger des lieux. Le cout varie selon le type de lieu. Elle se regenere automatiquement."
      rows={[
        { label: 'Points actuels', value: `${formatEnergy(energy, maxEnergy)} / ${maxEnergy}` },
        { label: 'Regeneration', value: `+${ratePerHour.toFixed(2)} / heure` },
        ...(hasRegenBonus ? [
          { label: 'Regen de base', value: `+${baseRate.toFixed(2)} / heure` },
          { label: 'Bonus regen faction', value: `+${(ratePerHour - baseRate).toFixed(2)} / heure`, highlight: true },
        ] : []),
      ]}
      onClose={onClose}
    />
  )
}
