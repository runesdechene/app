import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { isDemoMode } from '../../lib/demo/isDemoMode'
import { EnigmaMenu, type EnigmaMenuFragment } from '../enigma/EnigmaMenu'
import parcheminIcon from '../../assets/parchemin.png'
import './DailyEnigmaCard.css'

interface Props {
  onOpen: () => void
  onOpenFragment: (fragment: { fragmentId: number; name: string; icon: string | null; iconUrl: string | null }) => void
  refreshKey?: number
}

function getCountdown(): string {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h${m.toString().padStart(2, '0')}`
}

export function DailyEnigmaCard({ onOpen, onOpenFragment, refreshKey }: Props) {
  const userId = usePlayerStore((s) => s.userId)
  const [dailyDone, setDailyDone] = useState(false)
  const [countdown, setCountdown] = useState(getCountdown())
  const [fragments, setFragments] = useState<EnigmaMenuFragment[]>([])
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      const d = data as { all_answered?: boolean } | null
      // Borne démo : énigmes infinies → la carte reste toujours disponible.
      setDailyDone(isDemoMode() ? false : !!d?.all_answered)
    })

    supabase.rpc('get_my_fragment_status', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      if (data && Array.isArray(data)) {
        setFragments(data as EnigmaMenuFragment[])
      }
    })

    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 60000)
    return () => clearInterval(id)
  }, [])

  const fragmentsWithEnigma = fragments.filter((f) => f.hasEnigma || f.enigmaCooldown)
  const hasFragments = fragmentsWithEnigma.length > 0
  const availableCount = (dailyDone ? 0 : 1) + fragmentsWithEnigma.filter((f) => !f.enigmaCooldown).length

  function handleClick() {
    // Si pas de fragments dispos, on saute le menu et on ouvre l'énigme du
    // jour direct (pattern aligné sur EnigmaChestButton de la carte).
    if (!hasFragments) {
      if (!dailyDone) onOpen()
      return
    }
    setShowMenu(true)
  }

  return (
    <>
      <button
        type="button"
        className={`daily-enigma-card${dailyDone && !hasFragments ? ' done' : ''}`}
        onClick={handleClick}
        disabled={dailyDone && !hasFragments}
      >
        <img src={parcheminIcon} alt="" className="daily-enigma-card-icon" aria-hidden />
        <span className="daily-enigma-card-content">
          <span className="daily-enigma-card-title">Énigmes du jour</span>
          <span className="daily-enigma-card-sub">
            {dailyDone && !hasFragments
              ? `Résolue ✓ — réinitialise dans ${countdown}`
              : 'Choisis une thématique…'}
          </span>
        </span>
        {availableCount > 0 && (
          <span className="daily-enigma-card-badge" aria-label={`${availableCount} énigmes disponibles`}>
            {availableCount} disponible{availableCount > 1 ? 's' : ''}
          </span>
        )}
      </button>

      {showMenu && (
        <EnigmaMenu
          dailyDone={dailyDone}
          dailyCountdown={countdown}
          fragments={fragments}
          onSelectDaily={() => { setShowMenu(false); onOpen() }}
          onSelectFragment={(f) => { setShowMenu(false); onOpenFragment(f) }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </>
  )
}
