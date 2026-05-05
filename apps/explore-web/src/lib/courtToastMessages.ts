// Mapping centralisé : event Cour (activity_log) → toast message.
// Utilisé par useCourtNotifications (live-feed Realtime) ET
// loadRecentActivityToasts (replay au reload, historique 7 jours).

export interface CourtActivityRow {
  type: string
  actor_id: string | null
  place_id: string | null
  data: {
    placeTitle?: string
    actorName?: string
    expeditionId?: string
    score?: number
    total?: number
    oldExpeditionId?: string
    newExpeditionId?: string
    reclaimedBy?: string
    fromVacant?: boolean
    threatsCleared?: number
  } | null
}

export const COURT_TYPES = new Set<string>([
  'place_court_attack',
  'place_court_high_threat',
  'place_taken_remote',
  'place_taken_remote_self',
  'place_taken_back_gps',
  'place_reaffirmed',
  'mecene_principal_gained',
])

export interface CourtToastBuilt {
  message: string
  highlights: string[]
}

/** Construit le message d'un toast Cour. Retourne null si l'event ne doit pas
 *  s'afficher pour ce user (filtrage isSelf etc.). */
export function buildCourtToast(row: CourtActivityRow, currentUserId: string): CourtToastBuilt | null {
  const isSelf = row.actor_id === currentUserId
  const placeTitle = row.data?.placeTitle ?? 'un lieu'
  const actorName = isSelf ? 'Vous' : (row.data?.actorName ?? "Quelqu'un")

  switch (row.type) {
    case 'place_court_attack':
      if (isSelf) return null
      return {
        message: `⚔ ${actorName} s'intéresse à ${placeTitle}`,
        highlights: [actorName, placeTitle],
      }
    case 'place_court_high_threat':
      return {
        message: `🔥 ${placeTitle} est sous forte pression`,
        highlights: [placeTitle],
      }
    case 'place_taken_remote':
      if (isSelf) return null
      return {
        message: `⚡ ${actorName} a pris ${placeTitle} à distance`,
        highlights: [actorName, placeTitle],
      }
    case 'place_taken_remote_self':
      if (!isSelf) return null
      if (row.data?.fromVacant) {
        return {
          message: `🏴 Vous avez posé votre marque sur ${placeTitle} — allez-y physiquement pour la confirmer`,
          highlights: [placeTitle],
        }
      }
      return {
        message: `⚡ Vous tenez ${placeTitle} à distance — allez-y physiquement pour le confirmer`,
        highlights: [placeTitle],
      }
    case 'place_taken_back_gps':
      if (isSelf) {
        return {
          message: `🛡️ Vous avez repris ${placeTitle} par votre marche`,
          highlights: [placeTitle],
        }
      }
      return {
        message: `🛡️ L'ancien veilleur a repris ${placeTitle}`,
        highlights: [placeTitle],
      }
    case 'place_reaffirmed': {
      const cleared = row.data?.threatsCleared ?? 0
      if (isSelf) {
        return {
          message: cleared > 0
            ? `🛡️ Vous avez réaffirmé votre veille sur ${placeTitle} — ${cleared} menace${cleared > 1 ? 's' : ''} effacée${cleared > 1 ? 's' : ''}`
            : `🛡️ Vous êtes repassé sur ${placeTitle}`,
          highlights: [placeTitle],
        }
      }
      return {
        message: `🛡️ ${actorName} a réaffirmé sa veille sur ${placeTitle}`,
        highlights: [actorName, placeTitle],
      }
    }
    case 'mecene_principal_gained':
      if (!isSelf) return null
      return {
        message: `🪙 Vous êtes désormais Mécène Principal de ${placeTitle}`,
        highlights: [placeTitle],
      }
    default:
      return null
  }
}
