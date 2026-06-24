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

/** 'general' | 'bugs' | <companyId> (une Compagnie = la faction, channel = son id) */
export type ChatChannel = string

const MAX_MESSAGES = 100

interface ChatState {
  /** Filtres d'affichage des canaux fixes */
  showGeneral: boolean
  showBugs: boolean
  toggleShowGeneral: () => void
  toggleShowBugs: () => void

  /** Filtres d'affichage par Compagnie (clé = companyId ; défaut = visible) */
  showCompany: Record<string, boolean>
  toggleShowCompany: (companyId: string) => void

  /** Canal d'envoi ('general' | 'bugs' | companyId) */
  sendChannel: ChatChannel
  setSendChannel: (ch: ChatChannel) => void

  generalMessages: ChatMessage[]
  addGeneralMessage: (msg: ChatMessage) => void
  setGeneralMessages: (msgs: ChatMessage[]) => void

  bugsMessages: ChatMessage[]
  addBugsMessage: (msg: ChatMessage) => void
  setBugsMessages: (msgs: ChatMessage[]) => void

  /** Messages par Compagnie (clé = companyId) */
  companyMessages: Record<string, ChatMessage[]>
  addCompanyMessage: (msg: ChatMessage) => void
  setCompanyMessages: (companyId: string, msgs: ChatMessage[]) => void
  /** Purge les buckets des Compagnies qu'on ne suit plus. */
  pruneCompanies: (keepIds: string[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  showGeneral: true,
  showBugs: true,
  toggleShowGeneral: () => set((s) => ({ showGeneral: !s.showGeneral })),
  toggleShowBugs: () => set((s) => ({ showBugs: !s.showBugs })),

  showCompany: {},
  toggleShowCompany: (companyId) =>
    set((s) => ({
      showCompany: { ...s.showCompany, [companyId]: s.showCompany[companyId] === false },
    })),

  sendChannel: 'general',
  setSendChannel: (ch) => set({ sendChannel: ch }),

  generalMessages: [],
  addGeneralMessage: (msg) =>
    set((state) => {
      if (state.generalMessages.some((m) => m.id === msg.id)) return state
      return { generalMessages: [...state.generalMessages, msg].slice(-MAX_MESSAGES) }
    }),
  setGeneralMessages: (msgs) => set({ generalMessages: msgs.slice(-MAX_MESSAGES) }),

  bugsMessages: [],
  addBugsMessage: (msg) =>
    set((state) => {
      if (state.bugsMessages.some((m) => m.id === msg.id)) return state
      return { bugsMessages: [...state.bugsMessages, msg].slice(-MAX_MESSAGES) }
    }),
  setBugsMessages: (msgs) => set({ bugsMessages: msgs.slice(-MAX_MESSAGES) }),

  companyMessages: {},
  addCompanyMessage: (msg) =>
    set((state) => {
      const current = state.companyMessages[msg.channel] ?? []
      if (current.some((m) => m.id === msg.id)) return state
      return {
        companyMessages: {
          ...state.companyMessages,
          [msg.channel]: [...current, msg].slice(-MAX_MESSAGES),
        },
      }
    }),
  setCompanyMessages: (companyId, msgs) =>
    set((state) => ({
      companyMessages: { ...state.companyMessages, [companyId]: msgs.slice(-MAX_MESSAGES) },
    })),
  pruneCompanies: (keepIds) =>
    set((state) => {
      const next: Record<string, ChatMessage[]> = {}
      for (const id of keepIds) if (state.companyMessages[id]) next[id] = state.companyMessages[id]
      return { companyMessages: next }
    }),
}))
