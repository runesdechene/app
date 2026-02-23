import { create } from 'zustand'

export interface OnlinePlayer {
  userId: string
  name: string
  position: { lng: number; lat: number }
  factionColor: string | null
  factionPattern: string | null
  avatarUrl: string | null
  lastSeen: number
}

interface PlayersState {
  players: Map<string, OnlinePlayer>
  setPlayer: (player: OnlinePlayer) => void
  removePlayer: (userId: string) => void
  clearAll: () => void
}

export const usePlayersStore = create<PlayersState>((set) => ({
  players: new Map(),

  setPlayer: (player) =>
    set((state) => {
      const next = new Map(state.players)
      next.set(player.userId, player)
      return { players: next }
    }),

  removePlayer: (userId) =>
    set((state) => {
      const next = new Map(state.players)
      next.delete(userId)
      return { players: next }
    }),

  clearAll: () => set({ players: new Map() }),
}))
