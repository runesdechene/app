import { create } from 'zustand'

/**
 * Modal changelog (déclenchable depuis n'importe où — clic sur le badge
 * version ou sur le logo en haut). Le modal lui-même vit dans <ChangelogModal />
 * monté une fois dans RequireAuth.
 */
interface ChangelogState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useChangelogStore = create<ChangelogState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
