import { DailyQuestsList } from '../quests/DailyQuestsList'
import { ExpeditionsList } from '../expeditions/ExpeditionsList'
import './HomeQuestsBoard.css'

interface Props {
  onOpenExpedition: (expeditionId: string) => void
}

/**
 * Tableau de Quête & Événements — embed sur la HomePage.
 * Réutilise DailyQuestsList + ExpeditionsList existants.
 */
export function HomeQuestsBoard({ onOpenExpedition }: Props) {
  return (
    <section className="home-quests-board">
      <h2 className="home-quests-board-title">Tableau de Quête & Événements</h2>
      <div className="home-quests-board-section">
        <h3>Quêtes du jour</h3>
        <DailyQuestsList />
      </div>
      <div className="home-quests-board-section">
        <h3>Mes événements</h3>
        <ExpeditionsList onOpenExpedition={onOpenExpedition} />
      </div>
    </section>
  )
}
