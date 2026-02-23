import { useEffect, useRef } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'

const CYCLE_SECONDS = 14400 // 4h → +0.25/h (6 pts/jour)
const REGEN_RATE = 1 // fixe

const CONFIG = {
  conquest: {
    icon: '\u2694\uFE0F', // ⚔️
    label: 'Conquete',
    pointsKey: 'conquestPoints' as const,
    maxKey: 'maxConquest' as const,
    nextKey: 'conquestNextPointIn' as const,
    setNextKey: 'setConquestNextPointIn' as const,
  },
  construction: {
    icon: '\u{1F528}', // 🔨
    label: 'Construction',
    pointsKey: 'constructionPoints' as const,
    maxKey: 'maxConstruction' as const,
    nextKey: 'constructionNextPointIn' as const,
    setNextKey: 'setConstructionNextPointIn' as const,
  },
} as const

interface Props {
  type: 'conquest' | 'construction'
}

export function ResourceIndicator({ type }: Props) {
  const cfg = CONFIG[type]

  const points = useFogStore(s => s[cfg.pointsKey])
  const maxPoints = useFogStore(s => s[cfg.maxKey])
  const nextPointIn = useFogStore(s => s[cfg.nextKey])
  const setNext = useFogStore(s => s[cfg.setNextKey])
  const userId = useFogStore(s => s.userId)

  const isFull = points >= maxPoints

  // Fractional resource (smooth progression)
  const elapsedInTick = CYCLE_SECONDS - nextPointIn
  const fractionOfTick = CYCLE_SECONDS > 0 ? elapsedInTick / CYCLE_SECONDS : 0
  const fractional = isFull
    ? maxPoints
    : Math.min(points + fractionOfTick * REGEN_RATE, maxPoints)

  const ratePerHour = 0.25

  // Countdown timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (isFull || nextPointIn <= 0) return

    timerRef.current = setInterval(() => {
      const current = useFogStore.getState()[cfg.nextKey]
      if (current <= 1) {
        if (timerRef.current) clearInterval(timerRef.current)
        refetch()
      } else {
        setNext(current - 1)
      }
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isFull, nextPointIn > 0])

  async function refetch() {
    if (!userId) return
    const { data } = await supabase.rpc('get_user_energy', { p_user_id: userId })
    if (!data) return
    const d = data as Record<string, number>

    useFogStore.getState().setEnergy(d.energy ?? 0)
    useFogStore.getState().setNextPointIn(d.nextPointIn ?? 0)
    useFogStore.getState().setConquestPoints(d.conquestPoints ?? 0)
    useFogStore.getState().setConquestNextPointIn(d.conquestNextPointIn ?? 0)
    useFogStore.getState().setConstructionPoints(d.constructionPoints ?? 0)
    useFogStore.getState().setConstructionNextPointIn(d.constructionNextPointIn ?? 0)
  }

  function formatVal(n: number): string {
    if (n >= maxPoints) return String(maxPoints)
    const rounded = Math.floor(n * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
  }

  const fillPercent = (fractional / maxPoints) * 100

  return (
    <div className="energy-indicator">
      <div className="energy-main">
        <span className="energy-icon">{cfg.icon}</span>
        <span className="energy-count">{formatVal(fractional)}/{maxPoints}</span>
        <div className="energy-bar">
          <div className="energy-bar-fill" style={{ width: `${fillPercent}%` }} />
        </div>
      </div>
      <div className="energy-sub">
        <span className="energy-rate">+{ratePerHour}/h</span>
      </div>
    </div>
  )
}
