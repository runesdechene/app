import './GloryProgressBar.css'

interface Props {
  xpTotal: number
  xpForNextLevel: number   // xp totale nécessaire pour atteindre level+1
  xpToNextLevel: number    // xp restante avant level+1
  level: number
}

export function GloryProgressBar({ xpTotal: _xpTotal, xpForNextLevel, xpToNextLevel, level }: Props) {
  const isCap = level >= 50
  const progressPct = isCap
    ? 100
    : Math.min(100, Math.max(0, ((xpForNextLevel - xpToNextLevel) / xpForNextLevel) * 100))

  return (
    <div className="glory-bar">
      <div className="glory-bar__track">
        <div className="glory-bar__fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="glory-bar__text">
        {isCap
          ? 'Cap atteint — tu es Légende.'
          : <><strong>{xpToNextLevel}</strong> Gloire avant le prochain niveau</>
        }
      </div>
    </div>
  )
}
