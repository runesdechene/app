import { useNotificationStore, Notification } from '../../stores/notificationStore'
import { useMapStore } from '../../stores/mapStore'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { useUserAvatars } from '../../hooks/useUserAvatars'
import { resolveNotificationTarget } from '../../lib/notificationTarget'
import './NotificationPanel.css'

/** Types de notif où l'avatar de l'acteur a plus de sens que l'icône
 *  (action interpersonnelle directe : like, message, demande, attaque mécène…). */
const AVATAR_NOTIF_TYPES = new Set<Notification['type']>([
  'like_carnet',
  'new_carnet',
  'place_court_attack',
  'place_taken_remote',
  'place_taken_back_gps',
  'place_reaffirmed',
  'expedition_join_request',
  'expedition_auto_joined',
  'expedition_report_posted',
  'expedition_message',
  // V0.9 — Fiches collaboratives (actions interpersonnelles directes)
  'new_comment',
  'comment_reply',
  'like_contribution',
  'description_edited',
  'new_photo',
])

function getActorIdForNotif(notif: Notification): string | null {
  const d = notif.data as Record<string, unknown>
  if (typeof d.actorId === 'string') return d.actorId
  if (typeof d.requesterUserId === 'string') return d.requesterUserId
  if (typeof d.authorUserId === 'string') return d.authorUserId
  // place_taken_* embarquent l'avatar du nouveau veilleur dans members[0]
  const members = d.members as Array<{ userId?: string }> | undefined
  if (members && members.length > 0 && typeof members[0]?.userId === 'string') {
    return members[0].userId
  }
  return null
}

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
  place_court_support: '\uD83E\uDD1D',
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
  // V0.9 \u2014 Fiches collaboratives
  new_comment: '\uD83D\uDCAC',                  // \uD83D\uDCAC
  comment_reply: '\u21A9\uFE0F',                // \u21A9\uFE0F
  like_contribution: '\u2764\uFE0F',            // \u2764\uFE0F
  description_edited: '\u270F\uFE0F',           // \u270F\uFE0F
  new_photo: '\uD83D\uDCF7',                    // \uD83D\uDCF7
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
    case 'place_court_support': {
      const amt = d.amount ?? 0
      return `${d.actorName || 'Quelqu\'un'} est venu à votre secours sur ${place}${amt > 0 ? ` (+${amt} 🪙)` : ''}`
    }
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
    // V0.9 — Fiches collaboratives
    case 'new_comment':
      return `${d.actorName || 'Quelqu\'un'} a commenté ${d.placeTitle || 'un de vos lieux'}`
    case 'comment_reply':
      return `${d.actorName || 'Quelqu\'un'} a répondu à votre commentaire sur ${d.placeTitle || 'un lieu'}`
    case 'like_contribution':
      return `${d.actorName || 'Quelqu\'un'} a aimé votre ${d.contributionType === 'description' ? 'description' : 'commentaire'} sur ${d.placeTitle || 'un lieu'}`
    case 'description_edited':
      return `${d.actorName || 'Quelqu\'un'} a enrichi la description de ${d.placeTitle || 'un lieu'} que vous avez contribuée`
    case 'new_photo':
      return `${d.actorName || 'Quelqu\'un'} a ajouté une photo à ${d.placeTitle || 'un de vos lieux'}`
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
  // Batch fetch des avatars : seulement pour les types o\u00f9 l'avatar a du sens
  // (parcimonie \u2014 ne pas humaniser les events syst\u00e9miques type milestones).
  const actorIds = notifications
    .filter((n) => AVATAR_NOTIF_TYPES.has(n.type))
    .map(getActorIdForNotif)
  const avatars = useUserAvatars(actorIds)

  function handleClick(notif: Notification) {
    // Routing par TYPE (cf. resolveNotificationTarget) : la clé `expeditionId`
    // est surchargée — voyage pour les notifs `expedition_*`, expédition de Cour
    // pour les notifs `place_*`. Brancher sur sa présence cassait les notifs Cour.
    const target = resolveNotificationTarget(notif)
    if (target.kind === 'expedition') {
      useExpeditionsStore.getState().requestOpenExpedition(target.id, target.tab)
    } else if (target.kind === 'place') {
      useMapStore.getState().setSelectedPlaceId(target.id, target.tab)
    }
    onClose()
  }

  return (
    <div className="notification-panel modal-mobile-fullscreen">
      <div className="notification-panel-header">
        <span className="notification-panel-title">Notifications</span>
        <button className="notification-panel-close" onClick={onClose}>{'\u2715'}</button>
      </div>
      <div className="notification-panel-list">
        {notifications.length === 0 ? (
          <div className="notification-panel-empty">Aucune notification</div>
        ) : (
          notifications.map((notif) => {
            const actorId = AVATAR_NOTIF_TYPES.has(notif.type) ? getActorIdForNotif(notif) : null
            const avatarUrl = actorId ? avatars[actorId] : null
            return (
              <button
                key={notif.id}
                className={`notification-item${notif.read ? '' : ' notification-unread'}`}
                onClick={() => handleClick(notif)}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="notification-avatar" />
                ) : (
                  <span className="notification-icon">{TYPE_ICONS[notif.type]}</span>
                )}
                <div className="notification-content">
                  <span className="notification-message">{formatMessage(notif)}</span>
                  <span className="notification-time">{getTimeAgo(notif.created_at)}</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
