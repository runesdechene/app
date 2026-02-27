import { useState } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'
import { FactionModal } from '../auth/FactionModal'

export function ConquestToggle() {
  const gameMode = useFogStore(s => s.gameMode)
  const userId = useFogStore(s => s.userId)
  const userFactionId = useFogStore(s => s.userFactionId)
  const setGameMode = useFogStore(s => s.setGameMode)
  const [showFactionModal, setShowFactionModal] = useState(false)

  async function handleToggle() {
    if (gameMode === 'exploration') {
      // Activer conquete — si pas de faction, ouvrir FactionModal d'abord
      if (!userFactionId) {
        setShowFactionModal(true)
      } else {
        persist('conquest')
      }
    } else {
      // Repasser en exploration
      persist('exploration')
    }
  }

  async function persist(mode: 'exploration' | 'conquest') {
    setGameMode(mode)
    if (userId) {
      await supabase.rpc('update_my_profile', {
        p_user_id: userId,
        p_game_mode: mode,
      })
    }
  }

  return (
    <>
      <button className="conquest-toggle" onClick={handleToggle}>
        <span className="conquest-toggle-icon">{'\u2694\uFE0F'}</span>
        <span className="conquest-toggle-label">Conquete</span>
        <span className={`conquest-toggle-switch ${gameMode === 'conquest' ? 'on' : ''}`} />
      </button>

      {showFactionModal && (
        <FactionModal
          onClose={(joined) => {
            setShowFactionModal(false)
            if (joined) persist('conquest')
          }}
          currentFactionId={userFactionId}
        />
      )}
    </>
  )
}
