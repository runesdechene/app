import { useState } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'

export function EnergyIndicator() {
  const energy = useFogStore(s => s.energy)
  const maxEnergy = useFogStore(s => s.maxEnergy)
  const userId = useFogStore(s => s.userId)
  const setEnergy = useFogStore(s => s.setEnergy)
  const [resetting, setResetting] = useState(false)

  const isFull = energy >= maxEnergy

  async function handleReset() {
    if (!userId || resetting || isFull) return
    setResetting(true)

    const { data } = await supabase.rpc('reset_user_energy', { p_user_id: userId })

    if (data?.energy !== undefined) {
      setEnergy(data.energy)
    } else {
      // Fallback optimiste
      setEnergy(maxEnergy)
    }
    setResetting(false)
  }

  return (
    <div className="energy-indicator" title={`${energy}/${maxEnergy} points d'énergie`}>
      {Array.from({ length: maxEnergy }, (_, i) => (
        <span
          key={i}
          className={`energy-dot ${i < energy ? 'energy-dot-full' : 'energy-dot-empty'}`}
        />
      ))}
      {!isFull && (
        <button
          className="energy-reset-btn"
          onClick={handleReset}
          disabled={resetting}
          title="Recharger l'énergie"
        >
          {resetting ? '...' : '⚡'}
        </button>
      )}
    </div>
  )
}
