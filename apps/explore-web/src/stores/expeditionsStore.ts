// Store Zustand du sous-système Expéditions joueur-joueur (V0.7+).
// Garde en mémoire :
//  - upcoming : liste des expés "à venir" (Tableau de Quêtes / panneau HUD)
//  - archives : liste des expés archivées (consultables publiquement)
//  - current  : payload complet de l'expédition actuellement ouverte (modale)
//  - messagesByExpedition : chat live, par expedition_id
//
// Cf. apps/explore-web/CLAUDE.md (10 stores Zustand existants).

import { create } from 'zustand'
import type {
  ExpeditionListItem,
  ExpeditionFullPayload,
  ExpeditionMessage,
} from '../types/expedition'

interface ExpeditionsState {
  upcoming: ExpeditionListItem[]
  archives: ExpeditionListItem[]
  current: ExpeditionFullPayload | null
  messagesByExpedition: Record<string, ExpeditionMessage[]>

  setUpcoming: (l: ExpeditionListItem[]) => void
  setArchives: (l: ExpeditionListItem[]) => void
  setCurrent: (p: ExpeditionFullPayload | null) => void
  setMessages: (expeditionId: string, m: ExpeditionMessage[]) => void
  addMessage: (expeditionId: string, m: ExpeditionMessage) => void
  clearMessages: (expeditionId: string) => void
}

export const useExpeditionsStore = create<ExpeditionsState>((set) => ({
  upcoming: [],
  archives: [],
  current: null,
  messagesByExpedition: {},

  setUpcoming: (l) => set({ upcoming: l }),
  setArchives: (l) => set({ archives: l }),
  setCurrent: (p) => set({ current: p }),

  setMessages: (expeditionId, m) =>
    set((s) => ({
      messagesByExpedition: { ...s.messagesByExpedition, [expeditionId]: m },
    })),

  addMessage: (expeditionId, m) =>
    set((s) => {
      const existing = s.messagesByExpedition[expeditionId] ?? []
      // Dédup défensive — Realtime peut envoyer un INSERT déjà ajouté optimiste
      if (existing.some((x) => x.id === m.id)) return s
      return {
        messagesByExpedition: {
          ...s.messagesByExpedition,
          [expeditionId]: [...existing, m],
        },
      }
    }),

  clearMessages: (expeditionId) =>
    set((s) => {
      const next = { ...s.messagesByExpedition }
      delete next[expeditionId]
      return { messagesByExpedition: next }
    }),
}))
