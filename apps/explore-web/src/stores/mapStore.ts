import { create } from 'zustand'

interface PlaceOverride {
  tagTitle?: string
  tagColor?: string
  score?: number
  claimed?: boolean
  factionId?: string
  factionPattern?: string
  fortificationLevel?: number
  /** V0.7 — userId du veilleur principal (pour ouvrir son profil au click pilule carte) */
  veilleurUserId?: string
  /** V0.7 — nom du veilleur principal (lead member) du lieu, pour le rendu carte */
  veilleurName?: string
  /** V0.7 — avatar URL du veilleur principal (lead) */
  veilleurAvatarUrl?: string
  /** V0.7 — nombre de co-veilleurs en plus du lead (badge "+N" sur la pilule, 0 si solo) */
  veilleurExtraCount?: number
}

export interface TerritorySelection {
  territoryTitle: string
  customName: string | null
  anchorPlaceId: string
  placeIds: string[]
  topContributorId: string
  topContributorName: string
  factionTitle: string
  tagColor: string
  placesCount: number
  hourlyRate: number
  totalFortification: number
  players: string
}

interface MapState {
  selectedPlaceId: string | null
  setSelectedPlaceId: (id: string | null) => void

  /** ID du joueur dont le profil est ouvert (global) */
  selectedPlayerId: string | null
  setSelectedPlayerId: (id: string | null) => void

  /** Demande de fly-to depuis l'extérieur (toasts, etc.) */
  pendingFlyTo: { lng: number; lat: number; placeId?: string } | null
  requestFlyTo: (target: { lng: number; lat: number; placeId?: string }) => void
  clearPendingFlyTo: () => void

  /** V070 — Demande d'ouverture de la galerie Fragments dans le PlayerProfileModal
   *  (déclenchée depuis un toast d'énigme de fragment). Le PlayerProfileModal lit
   *  ce flag à chaque mount et appelle openFragmentCollection() automatiquement. */
  pendingOpenFragmentStore: boolean
  requestOpenFragmentStore: () => void
  clearPendingOpenFragmentStore: () => void

  /** Demande de zoom depuis l'extérieur (add-place, etc.) */
  pendingZoom: 'in' | 'out' | null
  requestZoom: (dir: 'in' | 'out') => void
  clearPendingZoom: () => void

  /** Overrides locaux pour tester les territoires (tag, likes) */
  placeOverrides: Map<string, PlaceOverride>
  setPlaceOverride: (placeId: string, override: PlaceOverride) => void

  /** IDs de lieux supprimes localement (pour retirer les marqueurs sans recharger) */
  deletedPlaceIds: Set<string>
  markPlaceDeleted: (placeId: string) => void

  /** Mode ajout de lieu */
  addPlaceMode: boolean
  setAddPlaceMode: (active: boolean) => void

  /** Coordonnées du centre de la carte (pour le viseur d'ajout) */
  pendingNewPlaceCoords: { lng: number; lat: number } | null
  setPendingNewPlaceCoords: (coords: { lng: number; lat: number } | null) => void

  /** Compteur de rafraîchissement des lieux (incrémenté après création/suppression) */
  placesRefreshKey: number
  incrementPlacesRefreshKey: () => void

  /** Mode de style de la carte : jeu (épuré), détaillé (parchemin+routes), satellite */
  mapStyleMode: 'game' | 'detailed' | 'satellite'
  setMapStyleMode: (mode: 'game' | 'detailed' | 'satellite') => void

  /** Niveau de zoom courant (0 monde, ~14 ville, ~22 rue). Mis à jour par ExploreMap.
   *  Lu par les overlays qui veulent compacter à bas zoom (NoteOverlay → icône). */
  mapZoom: number
  setMapZoom: (z: number) => void

  /** Territoire sélectionné (clic sur un blob) */
  selectedTerritoryData: TerritorySelection | null
  setSelectedTerritoryData: (data: TerritorySelection | null) => void

  /** Noms custom des territoires (anchor_place_id → {customName, namedBy}) */
  territoryNames: Map<string, { customName: string | null; namedBy: string }>
  setTerritoryNames: (names: Map<string, { customName: string | null; namedBy: string }>) => void
  setTerritoryName: (anchorPlaceId: string, customName: string | null, namedBy: string) => void
}

export const useMapStore = create<MapState>((set) => ({
  selectedPlaceId: null,
  setSelectedPlaceId: (id) => set({ selectedPlaceId: id }),

  selectedPlayerId: null,
  setSelectedPlayerId: (id) => set({ selectedPlayerId: id }),

  pendingFlyTo: null,
  requestFlyTo: (target) => set({ pendingFlyTo: target }),
  clearPendingFlyTo: () => set({ pendingFlyTo: null }),

  pendingOpenFragmentStore: false,
  requestOpenFragmentStore: () => set({ pendingOpenFragmentStore: true }),
  clearPendingOpenFragmentStore: () => set({ pendingOpenFragmentStore: false }),

  pendingZoom: null,
  requestZoom: (dir) => set({ pendingZoom: dir }),
  clearPendingZoom: () => set({ pendingZoom: null }),

  placeOverrides: new Map(),
  setPlaceOverride: (placeId, override) =>
    set((state) => {
      const next = new Map(state.placeOverrides)
      next.set(placeId, { ...next.get(placeId), ...override })
      return { placeOverrides: next }
    }),

  deletedPlaceIds: new Set(),
  markPlaceDeleted: (placeId) =>
    set((state) => {
      const next = new Set(state.deletedPlaceIds)
      next.add(placeId)
      return { deletedPlaceIds: next }
    }),

  addPlaceMode: false,
  setAddPlaceMode: (active) => set({ addPlaceMode: active }),

  mapZoom: 6,
  setMapZoom: (z) => set({ mapZoom: z }),

  pendingNewPlaceCoords: null,
  setPendingNewPlaceCoords: (coords) => set({ pendingNewPlaceCoords: coords }),

  placesRefreshKey: 0,
  incrementPlacesRefreshKey: () => set((state) => ({ placesRefreshKey: state.placesRefreshKey + 1 })),

  mapStyleMode: 'game',
  setMapStyleMode: (mode) => set({ mapStyleMode: mode }),

  selectedTerritoryData: null,
  setSelectedTerritoryData: (data) => set({ selectedTerritoryData: data }),

  territoryNames: new Map(),
  setTerritoryNames: (names) => set({ territoryNames: names }),
  setTerritoryName: (anchorPlaceId, customName, namedBy) =>
    set((state) => {
      const next = new Map(state.territoryNames)
      next.set(anchorPlaceId, { customName, namedBy })
      return { territoryNames: next }
    }),
}))
