import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { InfoModal } from './InfoModal'

const CONFIG = {
  conquest: {
    icon: '\uD83D\uDC51', // 👑
    label: 'Noblesse',
    pointsKey: 'conquestPoints' as const,
    maxKey: 'maxConquest' as const,
    nextKey: 'conquestNextPointIn' as const,
    cycleKey: 'conquestCycle' as const,
    bonusKey: 'bonusConquest' as const,
  },
  construction: {
    icon: '\uD83D\uDD2E', // 🔮
    label: 'Sagesse',
    pointsKey: 'constructionPoints' as const,
    maxKey: 'maxConstruction' as const,
    nextKey: 'constructionNextPointIn' as const,
    cycleKey: 'constructionCycle' as const,
    bonusKey: 'bonusConstruction' as const,
  },
  vitalite: {
    icon: '\u{1F33F}', // 🌿
    label: 'Vitalité',
    pointsKey: 'vitalitePoints' as const,
    maxKey: 'maxVitalite' as const,
    nextKey: 'vitaliteNextPointIn' as const,
    cycleKey: 'vitaliteCycle' as const,
    bonusKey: 'bonusVitalite' as const,
  },
} as const

interface Props {
  type: 'conquest' | 'construction' | 'vitalite'
}

export function ResourceIndicator({ type }: Props) {
  const cfg = CONFIG[type]

  const points = usePlayerStore(s => s[cfg.pointsKey])
  const maxPoints = usePlayerStore(s => s[cfg.maxKey])
  const cycleSeconds = usePlayerStore(s => s[cfg.cycleKey])
  const nextPointIn = usePlayerStore(s => s[cfg.nextKey])
  const bonus = usePlayerStore(s => s[cfg.bonusKey])

  const isFull = points >= maxPoints

  // Fractional resource (smooth progression)
  const elapsedInTick = cycleSeconds - nextPointIn
  const fractionOfTick = cycleSeconds > 0 ? elapsedInTick / cycleSeconds : 0
  const fractional = isFull
    ? maxPoints
    : Math.min(points + fractionOfTick, maxPoints)

  const ratePerHour = 3600 / cycleSeconds

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
    conquest: "La Noblesse permet de decouvrir et proteger les monuments, capitales et sites de pouvoir. Elle se regenere automatiquement.",
    construction: "La Sagesse permet de decouvrir et proteger les temples, abbayes et lieux sacres. Elle se regenere automatiquement.",
    vitalite: "La Vitalite permet de decouvrir et proteger les forets, dolmens et sites naturels. Elle se regenere automatiquement.",
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
