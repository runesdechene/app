import { useNotificationStore, Notification } from '../../stores/notificationStore'
import { useMapStore } from '../../stores/mapStore'
import './NotificationPanel.css'

const TYPE_ICONS: Record<Notification['type'], string> = {
  like_carnet: '\u2764\uFE0F',
  new_carnet: '\uD83D\uDCDC',
  exploration: '\uD83E\uDDED',
  milestone_likes: '\uD83C\uDF1F',
  milestone_vues: '\uD83D\uDC41\uFE0F',
  milestone_exploration: '\u26F0\uFE0F',
  claim_lost: '\u2694\uFE0F',
  // V097 \u2014 La Cour
  place_court_attack: '\u2694\uFE0F',
  place_court_high_threat: '\uD83D\uDD25',
  place_taken_remote: '\u26A1',
  place_taken_remote_self: '\uD83C\uDFF4',
  place_taken_back_gps: '\uD83D\uDEE1\uFE0F',
  place_reaffirmed: '\uD83D\uDEE1\uFE0F',
  mecene_principal_gained: '\uD83E\uDE99',
  // V0.7+ \u2014 Exp\u00E9ditions joueur-joueur
  expedition_join_request: '\uD83D\uDC4B',     // \uD83D\uDC4B
  expedition_auto_joined: '\u2728',             // \u2728
  expedition_validated: '\u2705',               // \u2705
  expedition_rejected: '\u274C',                // \u274C
  expedition_modified: '\u270F\uFE0F',          // \u270F\uFE0F
  expedition_cancelled: '\uD83D\uDEAB',         // \uD83D\uDEAB
  expedition_report_posted: '\uD83D\uDCDC',     // \uD83D\uDCDC
  expedition_message: '\uD83D\uDCAC',           // \uD83D\uDCAC
  // V0.7.7 \u2014 Push notifications V1
  daily_enigma_ready: '\uD83C\uDF31',           // \uD83C\uDF31
  level_up_imminent: '\uD83C\uDF96\uFE0F',      // \uD83C\uDF96\uFE0F
  weekly_new_places_recap: '\uD83D\uDDFA\uFE0F', // \uD83D\uDDFA\uFE0F
}

function formatMessage(notif: Notification): string {
  const d = notif.data
  const place = d.placeTitle || 'un de vos lieux'
  switch (notif.type) {
    case 'like_carnet':
      return `${d.actorName || 'Quelqu\'un'} a aimé votre récit sur ${d.placeTitle || 'un lieu'}`
    case 'new_carnet':
      return `${d.actorName || 'Quelqu\'un'} a écrit un récit sur un lieu que vous avez exploré`
    case 'exploration': {
      const count = d.visitorsToday ?? 1
      if (count > 1) {
        return `${count} explorateurs ont visité un lieu que vous avez exploré`
      }
      return `${d.lastVisitorName || 'Quelqu\'un'} a visité un lieu que vous avez exploré`
    }
    case 'milestone_likes':
      return `Votre récit a atteint ${d.likeCount} cœurs`
    case 'milestone_vues':
      return `L'un de vos lieux a atteint ${d.viewCount} vues`
    case 'milestone_exploration':
      return `L'un de vos lieux a atteint ${d.explorerCount} explorateurs`
    case 'claim_lost':
      return `Une autre Maison d'Héritage a pris l'ascendant sur l'un de vos lieux`
    // V097 — La Cour
    case 'place_court_attack':
      return `${d.actorName || 'Quelqu\'un'} s'intéresse à ${place}`
    case 'place_court_high_threat':
      return `${place} est sous forte pression`
    case 'place_taken_remote':
      return `Vous avez perdu ${place} — un mécène a pris l'ascendant`
    case 'place_taken_remote_self':
      if (d.fromVacant) {
        return `Vous avez posé votre marque sur ${place} — confirmez-la sur place`
      }
      return `Vous tenez ${place} à distance — confirmez-le sur place`
    case 'place_taken_back_gps':
      return `L'ancien veilleur a repris ${place} par la marche`
    case 'place_reaffirmed': {
      const cleared = d.threatsCleared ?? 0
      return cleared > 0
        ? `${place} : ${cleared} menace${cleared > 1 ? 's' : ''} effacée${cleared > 1 ? 's' : ''} par le veilleur`
        : `Le veilleur de ${place} est repassé sur place`
    }
    case 'mecene_principal_gained':
      return `Vous êtes désormais Mécène Principal de ${place}`
    // V0.7+ — Événements
    case 'expedition_join_request':
      return `${d.requesterName || 'Quelqu\'un'} demande à rejoindre ${d.expeditionName || 'ton événement'}`
    case 'expedition_auto_joined':
      return `${d.requesterName || 'Un voyageur'} a rejoint ${d.expeditionName || 'ton événement'}`
    case 'expedition_validated':
      return d.autoValidated
        ? `Tu rejoins ${d.expeditionName || 'l\'événement'}`
        : `Le chef a validé ta participation à ${d.expeditionName || 'l\'événement'}`
    case 'expedition_rejected':
      return `Le chef n'a pas retenu ta demande pour ${d.expeditionName || 'l\'événement'}`
    case 'expedition_modified':
      return `${d.expeditionName || 'Un événement'} a été modifié`
    case 'expedition_cancelled':
      return `${d.expeditionName || 'Un événement'} a été annulé`
    case 'expedition_report_posted':
      return `${d.authorName || 'Un compagnon'} a laissé un compte rendu sur ${d.expeditionName || 'l\'événement'}`
    case 'expedition_message':
      return `${d.authorName || 'Un compagnon'} t'a écrit dans ${d.expeditionName || 'l\'événement'}${d.preview ? ' : « ' + d.preview + ' »' : ''}`
    // V0.7.7 — Push notifications V1
    case 'daily_enigma_ready':
      return `Ton énigme du jour t'attend.`
    case 'level_up_imminent':
      return `Plus que ${d.xp_diff ?? '?'} XP avant le niveau ${d.next_level ?? '?'}.`
    case 'weekly_new_places_recap':
      return d.sample_names_csv
        ? `${d.count ?? 0} nouveaux lieux cette semaine — ${d.sample_names_csv}…`
        : `${d.count ?? 0} nouveaux lieux cette semaine.`
  }
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  const weeks = Math.floor(days / 7)
  return `${weeks} sem.`
}

interface NotificationPanelProps {
  onClose: () => void
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const notifications = useNotificationStore((s) => s.notifications)

  function handleClick(notif: Notification) {
    if (notif.data.placeId) {
      useMapStore.getState().setSelectedPlaceId(notif.data.placeId)
    }
    onClose()
  }

  return (
    <div className="notification-panel">
      <div className="notification-panel-header">
        <span className="notification-panel-title">Notifications</span>
        <button className="notification-panel-close" onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className="notification-panel-list">
        {notifications.length === 0 ? (
          <div className="notification-panel-empty">Aucune notification</div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              className={`notification-item${notif.read ? '' : ' notification-unread'}`}
              onClick={() => handleClick(notif)}
            >
              <span className="notification-icon">{TYPE_ICONS[notif.type]}</span>
              <div className="notification-content">
                <span className="notification-message">{formatMessage(notif)}</span>
                <span className="notification-time">{getTimeAgo(notif.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
