import type { Notification } from '../stores/notificationStore'
import type { PlacePanelActiveTab } from '../types/placeDetail'

/**
 * Résout la cible d'ouverture d'une notification (clic in-app ou push).
 *
 * Règle clé : on route par **type** de notif, jamais par simple présence d'une
 * clé dans `data`. La clé `expeditionId` est surchargée :
 *   - notifs `expedition_*` → c'est un `voyages.id` (modale d'expédition joueur)
 *   - notifs Cour (`place_court_*`, `place_taken_*`) → c'est un `expeditions.id`
 *     de la Cour/Plantage, qui n'existe PAS côté voyages.
 * Brancher sur la présence de `expeditionId` envoyait donc les notifs Cour dans
 * le store voyages → échec silencieux, ni le lieu ni l'action ne s'ouvraient.
 */
export type NotificationTarget =
  | { kind: 'expedition'; id: string; tab: 'info' | 'chat' }
  | { kind: 'place'; id: string; tab: PlacePanelActiveTab | null }
  | { kind: 'none' }

/** Types dont l'action utile vit dans l'onglet Infos du lieu (La Cour). */
const COURT_NOTIF_TYPES = new Set<Notification['type']>([
  'place_court_attack', 'place_court_high_threat', 'place_court_support',
  'place_taken_remote', 'place_taken_remote_self',
  'place_taken_back_gps', 'place_reaffirmed',
  'mecene_principal_gained', 'claim_lost',
])

/** Types dont l'action utile est le carnet (onglet Carnets). */
const CARNET_NOTIF_TYPES = new Set<Notification['type']>([
  'like_carnet', 'new_carnet', 'milestone_likes',
])

export function resolveNotificationTarget(notif: Notification): NotificationTarget {
  const d = notif.data as Record<string, unknown>

  // Notifs voyages joueur-joueur → modale d'expédition (chat pour un message).
  if (notif.type.startsWith('expedition_')) {
    const id = typeof d.expeditionId === 'string' ? d.expeditionId : null
    if (!id) return { kind: 'none' }
    return { kind: 'expedition', id, tab: notif.type === 'expedition_message' ? 'chat' : 'info' }
  }

  // Tout le reste cible un lieu si un placeId est présent.
  const placeId = typeof d.placeId === 'string' ? d.placeId : null
  if (!placeId) return { kind: 'none' }

  const tab: PlacePanelActiveTab | null =
    COURT_NOTIF_TYPES.has(notif.type) ? 'infos'
    : CARNET_NOTIF_TYPES.has(notif.type) ? 'carnets'
    : null
  return { kind: 'place', id: placeId, tab }
}
