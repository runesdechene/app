import { create } from 'zustand'

export interface Notification {
  id: number
  type: 'like_carnet' | 'new_carnet' | 'exploration' | 'milestone_likes' | 'milestone_vues' | 'milestone_exploration' | 'claim_lost'
  data: {
    actorName?: string
    actorId?: string
    placeTitle?: string
    placeId?: string
    contributionId?: number
    likeCount?: number
    viewCount?: number
    explorerCount?: number
    visitorsToday?: number
    lastVisitorName?: string
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
