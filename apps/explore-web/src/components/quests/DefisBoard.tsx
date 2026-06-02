import { useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useDefisStore } from '../../stores/defisStore'
import { DefiCard } from './DefiCard'

/**
 * Tableau Défis v2 — 3 sections (quotidien / hebdo individuel / hebdo collectif).
 * Monte le refresh au premier rendu et quand userId change.
 */
export function DefisBoard() {
  const userId = usePlayerStore((s) => s.userId)
  const board = useDefisStore((s) => s.board)
  const refresh = useDefisStore((s) => s.refresh)

  useEffect(() => {
    if (userId) refresh(userId)
  }, [userId, refresh])

  const sections: Array<{ key: keyof typeof board; label: string }> = [
    { key: 'daily', label: 'Défi du jour' },
    { key: 'weeklyIndividual', label: 'Défi de la semaine' },
    { key: 'weeklyCollective', label: 'Défi collectif' },
  ]

  const rendered = sections.filter(({ key }) => board[key] !== null)
  if (rendered.length === 0) return null

  return (
    <>
      {rendered.map(({ key, label }) => {
        const defi = board[key]
        if (!defi) return null
        return (
          <section key={key} className="qbp-section">
            <h4 className="qbp-section-title">{label}</h4>
            <DefiCard defi={defi} label={label} />
          </section>
        )
      })}
    </>
  )
}
