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
  /** Bannières carte : published + passed (passed = rendu N&B + fade).
   *  Distinct de `upcoming` qui reste published-only pour la liste HUD. */
  mapBanners: ExpeditionListItem[]
  archives: ExpeditionListItem[]
  current: ExpeditionFullPayload | null
  messagesByExpedition: Record<string, ExpeditionMessage[]>
  /**
   * ID de l'expé que ExpeditionsHud doit ouvrir au prochain tick (ex : tap
   * sur une bannière de la carte). Le Hud reset à null après ouverture.
   */
  pendingOpenExpeditionId: string | null
  /** Tab mobile à afficher au mount de la modale (clic notif `expedition_message`
   *  → 'chat', sinon 'info'). Lu en même temps que pendingOpenExpeditionId. */
  pendingOpenExpeditionTab: 'info' | 'chat'
  /** Demande d'ouverture du créateur (depuis le FAB menu). */
  pendingOpenCreator: boolean

  setUpcoming: (l: ExpeditionListItem[]) => void
  setMapBanners: (l: ExpeditionListItem[]) => void
  setArchives: (l: ExpeditionListItem[]) => void
  setCurrent: (p: ExpeditionFullPayload | null) => void
  setMessages: (expeditionId: string, m: ExpeditionMessage[]) => void
  addMessage: (expeditionId: string, m: ExpeditionMessage) => void
  clearMessages: (expeditionId: string) => void
  requestOpenExpedition: (id: string | null, tab?: 'info' | 'chat') => void
  requestOpenCreator: (open: boolean) => void
}

export const useExpeditionsStore = create<ExpeditionsState>((set) => ({
  upcoming: [],
  mapBanners: [],
  archives: [],
  current: null,
  messagesByExpedition: {},
  pendingOpenExpeditionId: null,
  pendingOpenExpeditionTab: 'info',
  pendingOpenCreator: false,

  setUpcoming: (l) => set({ upcoming: l }),
  setMapBanners: (l) => set({ mapBanners: l }),
  requestOpenExpedition: (id, tab = 'info') =>
    set({ pendingOpenExpeditionId: id, pendingOpenExpeditionTab: tab }),
  requestOpenCreator: (open) => set({ pendingOpenCreator: open }),
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
