import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { EnigmaMenu, type EnigmaMenuFragment } from './EnigmaMenu'
import parcheminImg from '../../assets/parchemin.png'
import './DailyEnigma.css'

interface FragmentStatus extends EnigmaMenuFragment {
  collection: string | null
}

interface Props {
  onOpenDaily: () => void
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

export function EnigmaChestButton({ onOpenDaily, onOpenFragment, refreshKey }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [dailyDone, setDailyDone] = useState(false)
  const [fragments, setFragments] = useState<FragmentStatus[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [countdown, setCountdown] = useState(getCountdown())

  function refreshStatus() {
    if (!userId) return
    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data }) => {
      const d = data as { all_answered?: boolean } | null
      setDailyDone(!!d?.all_answered)
    })
    supabase.rpc('get_my_fragment_status', { p_user_id: userId }).then(({ data }) => {
      if (data && Array.isArray(data)) setFragments(data as FragmentStatus[])
    })
  }

  useEffect(() => { refreshStatus() }, [userId, refreshKey])

  // Countdown ticker
  useEffect(() => {
    const interval = setInterval(() => setCountdown(getCountdown()), 60000)
    return () => clearInterval(interval)
  }, [])

  const fragmentsWithEnigma = fragments.filter(f => f.hasEnigma || f.enigmaCooldown)
  const hasFragments = fragmentsWithEnigma.length > 0
  const availableCount = (dailyDone ? 0 : 1) + fragmentsWithEnigma.filter(f => !f.enigmaCooldown).length

  function handleClick() {
    if (!hasFragments) {
      onOpenDaily()
      return
    }
    setShowMenu(true)
  }

  function handleSelectDaily() {
    setShowMenu(false)
    onOpenDaily()
  }

  return (
    <>
      <button
        className={`enigma-chest-btn${availableCount > 0 ? ' pulse' : ''}`}
        onClick={handleClick}
        title="Enigmes"
      >
        <img
          src={parcheminImg}
          alt=""
          className={`enigma-chest-img${availableCount === 0 ? ' enigma-chest-img-done' : ''}`}
        />
        {availableCount > 0 && (
          <span className="enigma-chest-label">
            <span style={{ color: '#d4af37', fontWeight: 700 }}>{availableCount}</span>
          </span>
        )}
      </button>

      {showMenu && (
        <EnigmaMenu
          dailyDone={dailyDone}
          dailyCountdown={countdown}
          fragments={fragments}
          onSelectDaily={handleSelectDaily}
          onSelectFragment={(f) => { setShowMenu(false); onOpenFragment(f) }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </>
  )
}
