import type { ExpeditionListItem } from '../../../types/expedition'
import './ExpeditionBanner.css'

/**
 * Bannière "plantée" pour une expédition à venir.
 * Cf. maquette Scène 2 : 3 états visuels selon proximité de rdv_at.
 *
 * Rendu HTML (pas WebGL) — pour V1, on garde le marker DOM.
 * À LOD plus dezoomé (< zoom 8), on basculera plus tard vers
 * un layer natif MapLibre (cf. plan §10.3 LOD différé V1).
 */

interface Props {
  expedition: ExpeditionListItem
  onClick: () => void
}

export function ExpeditionBanner({ expedition, onClick }: Props) {
  const rdvAt = expedition.rdv_at
  const day = 24 * 60 * 60 * 1000
  const diffMs = rdvAt ? new Date(rdvAt).getTime() - Date.now() : null

  const isUnset = rdvAt === null
  const isToday = diffMs !== null && diffMs >= -day && diffMs < day
  const isTomorrow = diffMs !== null && diffMs >= day && diffMs < 2 * day
  const isSoon = diffMs !== null && diffMs >= 2 * day && diffMs < 7 * day
  const isFuture = diffMs !== null && diffMs >= 7 * day

  const className = [
    'expedition-banner',
    isToday && 'is-today',
    isTomorrow && 'is-tomorrow',
    isSoon && 'is-soon',
    isFuture && 'is-future',
    isUnset && 'is-unset',
  ].filter(Boolean).join(' ')

  const badge = isUnset
    ? 'À définir'
    : isToday
      ? "Aujourd'hui"
      : isTomorrow
        ? 'Demain'
        : isSoon
          ? 'Bientôt'
          : null

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={`Expédition ${expedition.name}`}
    >
      <span className="expedition-banner-flag" aria-hidden>🚩</span>
      <span className="expedition-banner-name">{expedition.name}</span>
      {badge && <span className="expedition-banner-badge">{badge}</span>}
    </button>
  )
}
