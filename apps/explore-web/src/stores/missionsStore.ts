import { create } from 'zustand'

interface MissionsStoreState {
  pendingOpenMissionSlug: string | null
  openMissionSlug: string | null
  requestOpen: (slug: string) => void
  consumePending: () => void
  close: () => void
}
export const useMissionsStore = create<MissionsStoreState>((set) => ({
  pendingOpenMissionSlug: null,
  openMissionSlug: null,
  requestOpen: (slug) => set({ pendingOpenMissionSlug: slug }),
  consumePending: () => set((s) => ({ openMissionSlug: s.pendingOpenMissionSlug, pendingOpenMissionSlug: null })),
  close: () => set({ openMissionSlug: null }),
}))
