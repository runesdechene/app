import { useFogStore } from '../../stores/fogStore'

export function EnergyIndicator() {
  const energy = useFogStore(s => s.energy)
  const maxEnergy = useFogStore(s => s.maxEnergy)

  return (
    <div className="energy-indicator" title={`${energy}/${maxEnergy} points d'énergie`}>
      {Array.from({ length: maxEnergy }, (_, i) => (
        <span
          key={i}
          className={`energy-dot ${i < energy ? 'energy-dot-full' : 'energy-dot-empty'}`}
        />
      ))}
    </div>
  )
}
