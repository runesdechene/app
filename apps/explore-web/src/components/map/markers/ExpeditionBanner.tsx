import type { ExpeditionListItem } from '../../../types/expedition'
import { getExpeditionCoverUrl } from '../../../lib/expeditionsApi'
import './ExpeditionBanner.css'

/**
 * Marker rond pour une expédition sur la carte.
 * Cf. retours UX 6 mai : médaillon rond > bandeau horizontal.
 *
 * Affichage :
 * - Si l'expé a une cover_image_url → photo dans le médaillon
 * - Sinon → avatar du chef
 * - Sinon → fond sépia avec 🚩 centré
 * Toujours : un petit 🚩 en pastille superposée bottom-right (signature
 * "expédition") + halo doré pulsant si l'expé est "Aujourd'hui".
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

  // Image source : cover > avatar chef > rien (fallback emoji)
  const coverUrl = expedition.cover_image_url
    ? getExpeditionCoverUrl(expedition.cover_image_url)
    : null
  const imgSrc = coverUrl ?? expedition.chief.avatar_url
  const factionRingStyle = expedition.chief.faction_color
    ? { borderColor: expedition.chief.faction_color }
    : undefined

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={`Expédition ${expedition.name}`}
      title={expedition.name}
    >
      <span className="expedition-banner-medallion" style={factionRingStyle}>
        {imgSrc ? (
          <img src={imgSrc} alt="" />
        ) : (
          <span className="expedition-banner-fallback" aria-hidden>🚩</span>
        )}
      </span>
      <span className="expedition-banner-flag" aria-hidden>🚩</span>
      {(expedition.unread_count ?? 0) > 0 && (
        <span className="expedition-banner-unread" aria-label={`${expedition.unread_count} non lu${(expedition.unread_count ?? 0) > 1 ? 's' : ''}`}>
          {(expedition.unread_count ?? 0) > 9 ? '9+' : expedition.unread_count}
        </span>
      )}
    </button>
  )
}
