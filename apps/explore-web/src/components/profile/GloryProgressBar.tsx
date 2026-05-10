import './GloryProgressBar.css'

interface Props {
  xpTotal: number
  /** xp totale cumulée nécessaire pour atteindre level+1 */
  xpForNextLevel: number
  /** V158 (10/05) — xp totale cumulée du seuil bas du niveau courant */
  xpForCurrentLevel: number
  /** xp restante avant level+1 */
  xpToNextLevel: number
  level: number
}

export function GloryProgressBar({ xpTotal, xpForNextLevel, xpForCurrentLevel, xpToNextLevel, level }: Props) {
  const isCap = level >= 50
  // V158 — progress = (xp acquise dans le niveau courant) / (taille du niveau courant)
  const span = Math.max(1, xpForNextLevel - xpForCurrentLevel)
  const xpInLevel = Math.max(0, xpTotal - xpForCurrentLevel)
  const progressPct = isCap
    ? 100
    : Math.min(100, Math.max(0, (xpInLevel / span) * 100))

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
