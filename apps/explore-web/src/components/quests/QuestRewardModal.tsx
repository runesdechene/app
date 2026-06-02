import { InfoModal } from '../map/modals/InfoModal'
import { useDailyQuestsStore } from '../../stores/dailyQuestsStore'

export function QuestRewardModal() {
  const reward = useDailyQuestsStore((s) => s.pendingRewards[0] ?? null)
  const shiftReward = useDailyQuestsStore((s) => s.shiftReward)
  if (!reward) return null
  const rows: { label: string; value: string; highlight?: boolean }[] = []
  if (reward.xp > 0) rows.push({ label: 'Expérience', value: `+${reward.xp} XP`, highlight: true })
  if (reward.crowns > 0) rows.push({ label: 'Couronnes', value: `+${reward.crowns} 🪙`, highlight: true })
  return (
    <InfoModal
      icon={reward.icon || '🏆'}
      title="Défi accompli !"
      description={reward.title}
      rows={rows}
      onClose={shiftReward}
    />
  )
}
