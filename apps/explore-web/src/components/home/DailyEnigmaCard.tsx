import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './DailyEnigmaCard.css'

interface Props {
  onOpen: () => void
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

export function DailyEnigmaCard({ onOpen, refreshKey }: Props) {
  const userId = usePlayerStore((s) => s.userId)
  const [dailyDone, setDailyDone] = useState(false)
  const [countdown, setCountdown] = useState(getCountdown())

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      const d = data as { all_answered?: boolean } | null
      setDailyDone(!!d?.all_answered)
    })
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <button
      type="button"
      className={`daily-enigma-card${dailyDone ? ' done' : ''}`}
      onClick={onOpen}
      disabled={dailyDone}
    >
      <span className="daily-enigma-card-icon" aria-hidden>📜</span>
      <span className="daily-enigma-card-content">
        <span className="daily-enigma-card-title">Énigme du jour</span>
        <span className="daily-enigma-card-sub">
          {dailyDone
            ? `Résolue ✓ — réinitialise dans ${countdown}`
            : 'Disponible — clique pour la résoudre'}
        </span>
      </span>
    </button>
  )
}
