import type { ExpeditionListItem } from '../../../types/expedition'
import './ExpeditionBanner.css'

/**
 * Marker d'événement sur la carte — SCEAU DE CIRE (refonte 25/06).
 * Retours UX : l'ancien médaillon photo 56px était trop gros / trop présent.
 * Désormais : un petit cachet de cire sépia (~30px) avec un étendard ⚑ estampé,
 * cohérent avec la DA parchemin/héraldique. La photo de couverture ne vit plus
 * sur la carte — elle s'affiche au tap, dans la modale de l'événement.
 *
 * États : « aujourd'hui » (liseré doré discret), « passé » (cire grisée + fade
 * J+1→J+7), badge de messages non lus.
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

  // Expédition passée (plus de 24h après le RDV) : cire grisée + opacité dégressive
  // de 1.0 (J+1) à 0.35 (J+7). Le cron retire la bannière de la carte à J+7.
  const passedAgeDays = diffMs !== null && diffMs < 0 ? -diffMs / day : 0
  const isPassed = passedAgeDays > 1
  const passedOpacity = isPassed
    ? Math.max(0.35, 1 - (0.65 * (passedAgeDays - 1)) / 6)
    : 1

  const className = [
    'expedition-banner',
    isToday && 'is-today',
    isTomorrow && 'is-tomorrow',
    isSoon && 'is-soon',
    isFuture && 'is-future',
    isUnset && 'is-unset',
    isPassed && 'is-passed',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={`Événement ${expedition.name}`}
      title={expedition.name}
      style={isPassed ? { opacity: passedOpacity } : undefined}
    >
      <span className="expedition-seal" aria-hidden>
        <img className="expedition-seal-icon" src="/event-seal-labarum.png" alt="" />
      </span>
      {(expedition.unread_count ?? 0) > 0 && (
        <span className="expedition-banner-unread" aria-label={`${expedition.unread_count} non lu${(expedition.unread_count ?? 0) > 1 ? 's' : ''}`}>
          {(expedition.unread_count ?? 0) > 9 ? '9+' : expedition.unread_count}
        </span>
      )}
    </button>
  )
}
