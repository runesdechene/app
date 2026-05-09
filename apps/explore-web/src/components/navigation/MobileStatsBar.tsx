import { StatsBar } from '../home/StatsBar'
import './MobileStatsBar.css'

interface MobileStatsBarProps {
  /** Si true, applique un dégradé en bas (utilisé sur /carte mobile pour fondre vers MapLibre). */
  fadeOutBottom?: boolean
}

export function MobileStatsBar({ fadeOutBottom = false }: MobileStatsBarProps) {
  return (
    <div className={`mobile-stats-bar${fadeOutBottom ? ' mobile-stats-bar--fade' : ''}`}>
      <StatsBar />
    </div>
  )
}
