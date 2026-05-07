import { useEffect, useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useDailyQuestsStore } from '../../stores/dailyQuestsStore'
import { DailyQuestCard } from './DailyQuestCard'
import { DailyQuestModal } from './DailyQuestModal'
import type { DailyQuest } from '../../types/dailyQuest'

/**
 * Section "Du jour" du panneau Quêtes — au-dessus des Événements.
 *
 * Charge get_today_quests_state au mount, refresh quand userId change.
 * Au click sur une card : ouvre la modale détaillée.
 */
export function DailyQuestsList() {
  const userId = usePlayerStore((s) => s.userId)
  const quests = useDailyQuestsStore((s) => s.quests)
  const refresh = useDailyQuestsStore((s) => s.refresh)
  const [openQuest, setOpenQuest] = useState<DailyQuest | null>(null)

  useEffect(() => {
    if (!userId) return
    refresh(userId)
  }, [userId, refresh])

  // Garde la version live (les progress/completedAt peuvent changer entre l'ouverture
  // et le rendu de la modale — on relit le store sur chaque render plutôt que figer).
  const liveOpen = openQuest
    ? quests.find((q) => q.id === openQuest.id) ?? openQuest
    : null

  if (quests.length === 0) return null

  return (
    <>
      <ul className="daily-quests-list">
        {quests.map((q) => (
          <DailyQuestCard key={q.id} quest={q} onClick={() => setOpenQuest(q)} />
        ))}
      </ul>
      {liveOpen && (
        <DailyQuestModal quest={liveOpen} onClose={() => setOpenQuest(null)} />
      )}
    </>
  )
}
