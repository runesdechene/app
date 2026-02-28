import { useEffect, useRef, useState } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'
import { InfoModal } from './InfoModal'

const CONFIG = {
  conquest: {
    icon: '\u2694\uFE0F', // ⚔️
    label: 'Conquete',
    pointsKey: 'conquestPoints' as const,
    maxKey: 'maxConquest' as const,
    nextKey: 'conquestNextPointIn' as const,
    setNextKey: 'setConquestNextPointIn' as const,
    cycleKey: 'conquestCycle' as const,
    bonusKey: 'bonusConquest' as const,
  },
  construction: {
    icon: '\u{1F528}', // 🔨
    label: 'Construction',
    pointsKey: 'constructionPoints' as const,
    maxKey: 'maxConstruction' as const,
    nextKey: 'constructionNextPointIn' as const,
    setNextKey: 'setConstructionNextPointIn' as const,
    cycleKey: 'constructionCycle' as const,
    bonusKey: 'bonusConstruction' as const,
  },
} as const

interface Props {
  type: 'conquest' | 'construction'
}

export function ResourceIndicator({ type }: Props) {
  const cfg = CONFIG[type]

  const points = useFogStore(s => s[cfg.pointsKey])
  const maxPoints = useFogStore(s => s[cfg.maxKey])
  const cycleSeconds = useFogStore(s => s[cfg.cycleKey])
  const nextPointIn = useFogStore(s => s[cfg.nextKey])
  const setNext = useFogStore(s => s[cfg.setNextKey])
  const userId = useFogStore(s => s.userId)
  const bonus = useFogStore(s => s[cfg.bonusKey])

  const isFull = points >= maxPoints

  // Fractional resource (smooth progression)
  const elapsedInTick = cycleSeconds - nextPointIn
  const fractionOfTick = cycleSeconds > 0 ? elapsedInTick / cycleSeconds : 0
  const fractional = isFull
    ? maxPoints
    : Math.min(points + fractionOfTick, maxPoints)

  const ratePerHour = 3600 / cycleSeconds

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
    useFogStore.getState().setEnergyCycle(d.energyCycle ?? 7200)
    useFogStore.getState().setConquestPoints(d.conquestPoints ?? 0)
    useFogStore.getState().setConquestNextPointIn(d.conquestNextPointIn ?? 0)
    useFogStore.getState().setConquestCycle(d.conquestCycle ?? 14400)
    useFogStore.getState().setConstructionPoints(d.constructionPoints ?? 0)
    useFogStore.getState().setConstructionNextPointIn(d.constructionNextPointIn ?? 0)
    useFogStore.getState().setConstructionCycle(d.constructionCycle ?? 14400)
    useFogStore.getState().setBonusEnergy(d.bonusEnergy ?? 0)
    useFogStore.getState().setBonusConquest(d.bonusConquest ?? 0)
    useFogStore.getState().setBonusConstruction(d.bonusConstruction ?? 0)
  }

  function formatVal(n: number): string {
    if (n >= maxPoints) return String(maxPoints)
    const rounded = Math.floor(n * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
  }

  const fillPercent = (fractional / maxPoints) * 100
  const defaultCycle = 14400
  const regenBonus = cycleSeconds < defaultCycle ? 'bonus' : cycleSeconds > defaultCycle ? 'malus' : ''
  const [showInfo, setShowInfo] = useState(false)

  const baseMax = maxPoints - bonus
  const baseCycle = 14400
  const baseRate = 3600 / baseCycle
  const hasRegenBonus = cycleSeconds !== baseCycle

  const INFO_TEXT: Record<string, string> = {
    conquest: "Les points de conquete permettent de revendiquer des lieux pour votre faction. Chaque revendication coute des points selon le niveau de fortification du lieu.",
    construction: "Les points de construction permettent de fortifier vos lieux revendiques. Chaque niveau de fortification rend le lieu plus difficile a conquerir par les factions adverses.",
  }

  return (
    <>
      <div className={`energy-indicator${regenBonus ? ` regen-${regenBonus}` : ''}`} onClick={() => setShowInfo(true)} style={{ cursor: 'pointer' }}>
        <div className="energy-main">
          <span className="energy-icon">{cfg.icon}</span>
          <span className="energy-count">
            {formatVal(fractional)}/<span className={bonus > 0 ? 'max-bonus' : bonus < 0 ? 'max-malus' : ''}>{maxPoints}</span>
          </span>
          <div className="energy-bar">
            <div className="energy-bar-fill" style={{ width: `${fillPercent}%` }} />
          </div>
        </div>
        <div className="energy-sub">
          <span className="energy-rate">+{ratePerHour.toFixed(2)}/h</span>
        </div>
      </div>

      {showInfo && (
        <InfoModal
          icon={cfg.icon}
          title={cfg.label}
          description={INFO_TEXT[type] ?? ''}
          rows={[
            { label: 'Points actuels', value: `${formatVal(fractional)} / ${maxPoints}` },
            { label: 'Regeneration', value: `+${ratePerHour.toFixed(2)} / heure` },
            ...(hasRegenBonus ? [
              { label: 'Regen de base', value: `+${baseRate.toFixed(2)} / heure` },
              { label: 'Bonus regen faction', value: `+${(ratePerHour - baseRate).toFixed(2)} / heure`, highlight: true },
            ] : []),
            ...(bonus !== 0 ? [
              { label: 'Capacite de base', value: String(baseMax) },
              { label: 'Bonus capacite faction', value: `${bonus > 0 ? '+' : ''}${bonus}`, highlight: true },
            ] : []),
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
