import { useState } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'

interface GameModeModalProps {
  onComplete: (mode: 'exploration' | 'conquest') => void
}

export function GameModeModal({ onComplete }: GameModeModalProps) {
  const [selected, setSelected] = useState<'exploration' | 'conquest' | null>(null)
  const userId = useFogStore(s => s.userId)
  const setGameMode = useFogStore(s => s.setGameMode)

  async function choose(mode: 'exploration' | 'conquest') {
    setSelected(mode)
    setGameMode(mode)

    // Persister en DB
    if (userId) {
      await supabase.rpc('update_my_profile', {
        p_user_id: userId,
        p_game_mode: mode,
      })
    }

    onComplete(mode)
  }

  return (
    <div className="gamemode-overlay">
      <div className="gamemode-modal">
        <h2 className="gamemode-title">Comment voulez-vous jouer ?</h2>
        <p className="gamemode-subtitle">Vous pourrez changer de mode a tout moment depuis la carte.</p>

        <div className="gamemode-options">
          <button
            className={`gamemode-option ${selected === 'exploration' ? 'selected' : ''}`}
            onClick={() => choose('exploration')}
            disabled={selected !== null}
          >
            <span className="gamemode-option-icon">{'\uD83E\uDDED'}</span>
            <h3 className="gamemode-option-title">Exploration</h3>
            <p className="gamemode-option-desc">
              Vous decouvrez des lieux selon vos points d'energie journaliers. Parfait pour decouvrir sa region, randonner, sortir le week-end...
            </p>
          </button>

          <button
            className={`gamemode-option ${selected === 'conquest' ? 'selected' : ''}`}
            onClick={() => choose('conquest')}
            disabled={selected !== null}
          >
            <span className="gamemode-option-icon">{'\u2694\uFE0F'}</span>
            <h3 className="gamemode-option-title">Conquete</h3>
            <p className="gamemode-option-desc">
              Tout du monde <b>Exploration</b>, mais vous rejoignez aussi une faction, revendiquez vos lieux favoris pour votre banniere, creez un micro-empire et fortifiez vos territoires.
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
