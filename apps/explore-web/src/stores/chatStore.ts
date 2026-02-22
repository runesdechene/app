import { create } from 'zustand'

export interface ChatMessage {
  id: number
  channel: string
  userId: string
  userName: string
  factionId: string | null
  factionColor: string | null
  factionPattern: string | null
  content: string
  createdAt: string
}

export type ChatChannel = 'general' | 'faction'

const MAX_MESSAGES = 100

interface ChatState {
  /** Filtres d'affichage (quels canaux on voit) */
  showGeneral: boolean
  showFaction: boolean
  toggleShowGeneral: () => void
  toggleShowFaction: () => void

  /** Canal d'envoi (où on écrit) */
  sendChannel: ChatChannel
  setSendChannel: (ch: ChatChannel) => void

  generalMessages: ChatMessage[]
  addGeneralMessage: (msg: ChatMessage) => void
  setGeneralMessages: (msgs: ChatMessage[]) => void

  factionMessages: ChatMessage[]
  addFactionMessage: (msg: ChatMessage) => void
  setFactionMessages: (msgs: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  showGeneral: true,
  showFaction: true,
  toggleShowGeneral: () => set((s) => ({ showGeneral: !s.showGeneral })),
  toggleShowFaction: () => set((s) => ({ showFaction: !s.showFaction })),

  sendChannel: 'general',
  setSendChannel: (ch) => set({ sendChannel: ch }),

  generalMessages: [],
  addGeneralMessage: (msg) =>
    set((state) => {
      if (state.generalMessages.some((m) => m.id === msg.id)) return state
      return { generalMessages: [...state.generalMessages, msg].slice(-MAX_MESSAGES) }
    }),
  setGeneralMessages: (msgs) => set({ generalMessages: msgs.slice(-MAX_MESSAGES) }),

  factionMessages: [],
  addFactionMessage: (msg) =>
    set((state) => {
      if (state.factionMessages.some((m) => m.id === msg.id)) return state
      return { factionMessages: [...state.factionMessages, msg].slice(-MAX_MESSAGES) }
    }),
  setFactionMessages: (msgs) => set({ factionMessages: msgs.slice(-MAX_MESSAGES) }),
}))
