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
  const [availableCount, setAvailableCount] = useState<number | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    // Énigme du jour
    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      const d = data as { all_answered?: boolean } | null
      setDailyDone(!!d?.all_answered)
    })

    // Fragments disponibles (pour le badge "X disponibles")
    supabase.rpc('get_my_fragment_status', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      if (data && Array.isArray(data)) {
        const count = (data as { hasEnigma?: boolean }[]).filter((f) => f.hasEnigma).length
        setAvailableCount(count)
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

  // Total disponible : énigme du jour (si pas faite) + fragments dispo
  const totalAvailable = (dailyDone ? 0 : 1) + (availableCount ?? 0)

  return (
    <button
      type="button"
      className={`daily-enigma-card${dailyDone ? ' done' : ''}`}
      onClick={onOpen}
      disabled={dailyDone}
    >
      <span className="daily-enigma-card-icon" aria-hidden>📜</span>
      <span className="daily-enigma-card-content">
        <span className="daily-enigma-card-title">Énigmes du jour</span>
        <span className="daily-enigma-card-sub">
          {dailyDone
            ? `Résolue ✓ — réinitialise dans ${countdown}`
            : 'Choisis une thématique…'}
        </span>
      </span>
      {!dailyDone && totalAvailable > 0 && (
        <span className="daily-enigma-card-badge" aria-label={`${totalAvailable} énigmes disponibles`}>
          {totalAvailable} disponible{totalAvailable > 1 ? 's' : ''}
        </span>
      )}
    </button>
  )
}
