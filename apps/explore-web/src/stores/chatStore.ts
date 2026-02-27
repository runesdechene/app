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

export type ChatChannel = 'general' | 'faction' | 'bugs'

const MAX_MESSAGES = 100

interface ChatState {
  /** Filtres d'affichage (quels canaux on voit) */
  showGeneral: boolean
  showFaction: boolean
  showBugs: boolean
  toggleShowGeneral: () => void
  toggleShowFaction: () => void
  toggleShowBugs: () => void

  /** Canal d'envoi (où on écrit) */
  sendChannel: ChatChannel
  setSendChannel: (ch: ChatChannel) => void

  generalMessages: ChatMessage[]
  addGeneralMessage: (msg: ChatMessage) => void
  setGeneralMessages: (msgs: ChatMessage[]) => void

  factionMessages: ChatMessage[]
  addFactionMessage: (msg: ChatMessage) => void
  setFactionMessages: (msgs: ChatMessage[]) => void

  bugsMessages: ChatMessage[]
  addBugsMessage: (msg: ChatMessage) => void
  setBugsMessages: (msgs: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  showGeneral: true,
  showFaction: true,
  showBugs: true,
  toggleShowGeneral: () => set((s) => ({ showGeneral: !s.showGeneral })),
  toggleShowFaction: () => set((s) => ({ showFaction: !s.showFaction })),
  toggleShowBugs: () => set((s) => ({ showBugs: !s.showBugs })),

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

  bugsMessages: [],
  addBugsMessage: (msg) =>
    set((state) => {
      if (state.bugsMessages.some((m) => m.id === msg.id)) return state
      return { bugsMessages: [...state.bugsMessages, msg].slice(-MAX_MESSAGES) }
    }),
  setBugsMessages: (msgs) => set({ bugsMessages: msgs.slice(-MAX_MESSAGES) }),
}))
