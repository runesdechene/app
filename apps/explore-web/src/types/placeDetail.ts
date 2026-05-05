// Types V0.5 du détail d'un lieu (retour de get_place_detail_v05).
// Extraits de PlacePanel.tsx pendant le sprint Purification (B16, mai 2026).

/** V0.5 detail data from get_place_detail_v05 */
export interface V05Detail {
  influence: Array<{ factionId: string; placed: number; permanent: number; content: number; total: number }>
  dominantFaction: string | null
  contributions: V05Contribution[]
  explorers: Array<{ userId: string; visitedAt: string; userName: string; userAvatar: string | null; factionId: string }>
  avgRating: number | null
  ratingCount: number
  userRating: number | null
  isWishlisted: boolean
  isExplorer: boolean
  guardian: { userId: string; name: string; avatar: string | null; factionId: string } | null
}

/** Raw contribution from the RPC */
export interface V05Contribution {
  id: number
  userId: string
  factionId: string
  type: string
  title: string | null
  content: string | null
  imageUrl: string | null
  images?: string[]
  rating?: number | null
  votesUp: number
  votesDown: number
  createdAt: string
  userName: string
  userAvatar: string | null
}

/** Onglets actifs dans le PlacePanel (vue découverte). */
export type PlacePanelActiveTab = 'carnets' | 'galerie' | 'infos' | 'admin'
