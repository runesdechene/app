import { create } from 'zustand'

export interface Notification {
  id: number
  type:
    | 'like_carnet' | 'new_carnet' | 'exploration'
    | 'milestone_likes' | 'milestone_vues' | 'milestone_exploration'
    | 'claim_lost'
    // V097 — La Cour
    | 'place_court_attack' | 'place_court_high_threat' | 'place_court_support'
    | 'place_taken_remote' | 'place_taken_remote_self'
    | 'place_taken_back_gps' | 'place_reaffirmed'
    | 'mecene_principal_gained'
    // V0.7+ — Expéditions joueur-joueur
    | 'expedition_join_request' | 'expedition_auto_joined'
    | 'expedition_validated' | 'expedition_rejected'
    | 'expedition_modified' | 'expedition_cancelled'
    | 'expedition_report_posted' | 'expedition_message'
    // V0.7.7 — Push notifications V1
    | 'daily_enigma_ready' | 'level_up_imminent' | 'weekly_new_places_recap'
    // V0.9 — Fiches collaboratives (carnet de route)
    | 'new_comment' | 'comment_reply' | 'like_contribution'
    | 'description_edited' | 'new_photo'
    // Correction de position de lieu
    | 'place_position_edited'
    // Récompense Couronnes manuelle (admin)
    | 'crowns_awarded'
  data: {
    actorName?: string
    actorId?: string
    actorAvatarUrl?: string | null
    placeTitle?: string
    placeId?: string
    contributionId?: number
    contributionType?: string
    likeCount?: number
    viewCount?: number
    distanceKm?: number
    explorerCount?: number
    visitorsToday?: number
    lastVisitorName?: string
    // V097 — Cour
    expeditionId?: string
    amount?: number
    fromVacant?: boolean
    threatsCleared?: number
    score?: number
    total?: number
    oldExpeditionId?: string
    newExpeditionId?: string
    reclaimedBy?: string
    plantedByUser?: string
    // V0.7+ — Expéditions joueur-joueur
    expeditionName?: string
    requesterUserId?: string
    requesterName?: string
    chiefName?: string
    authorName?: string
    authorUserId?: string
    isPublic?: boolean
    autoValidated?: boolean
    message?: string | null
    changedFields?: string[]
    preview?: string
    // V0.7.7 — Push notifications V1
    xp_diff?: number
    next_level?: number
    count?: number
    sample_names_csv?: string
    // Récompense Couronnes manuelle
    crowns?: number
    reason?: string
  }
  read: boolean
  created_at: string
}

interface NotificationState {
  notifications: Notification[]
  setNotifications: (notifs: Notification[]) => void
  addNotification: (notif: Notification) => void
  updateNotification: (notif: Notification) => void
  markAllRead: () => void
  unreadCount: () => number
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  setNotifications: (notifs) => set({ notifications: notifs }),

  addNotification: (notif) =>
    set((state) => ({
      notifications: [notif, ...state.notifications].slice(0, 50),
    })),

  updateNotification: (notif) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notif.id ? notif : n
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}))
