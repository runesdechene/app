import { useEffect, useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useDefisStore } from '../../stores/defisStore'
import { DefiCard } from './DefiCard'
import { DefiDetailModal } from './DefiDetailModal'

type SectionKey = 'daily' | 'weeklyIndividual' | 'weeklyCollective'

/**
 * Tableau Défis v2 — 3 sections (quotidien / hebdo individuel / hebdo collectif).
 * Monte le refresh au premier rendu et quand userId change.
 * Clic sur une carte → modale détail (lue en live sur le store pour refléter la progression).
 */
export function DefisBoard() {
  const userId = usePlayerStore((s) => s.userId)
  const board = useDefisStore((s) => s.board)
  const refresh = useDefisStore((s) => s.refresh)
  const [openKey, setOpenKey] = useState<SectionKey | null>(null)

  useEffect(() => {
    if (userId) refresh(userId)
  }, [userId, refresh])

  const sections: Array<{ key: SectionKey; label: string }> = [
    { key: 'daily', label: 'Défi du jour' },
    { key: 'weeklyIndividual', label: 'Défi de la semaine' },
    { key: 'weeklyCollective', label: 'Défi collectif' },
  ]

  const rendered = sections.filter(({ key }) => board[key] !== null)
  if (rendered.length === 0) return null

  // Version live du défi ouvert (la progression peut changer pendant que la modale est ouverte).
  const openDefi = openKey ? board[openKey] : null

  return (
    <>
      {/* Une seule section : les trois défis partagent un design unifié et la
          pastille de cadence porte le label, donc plus de titre par défi. */}
      <section className="qbp-section">
        {rendered.map(({ key, label }) => {
          const defi = board[key]
          if (!defi) return null
          return <DefiCard key={key} defi={defi} label={label} onClick={() => setOpenKey(key)} />
        })}
      </section>
      {openDefi && <DefiDetailModal defi={openDefi} onClose={() => setOpenKey(null)} />}
    </>
  )
}
