// V0.7 phase 3 — Coupe des Héritages
// Compétition saine entre factions via actions personnelles des membres.
// Spec : voir migration 023_v07_coupe_seasons.sql

export interface CoupeSeason {
  id: number
  name: string
  startedAt: string
  endedAt: string | null
  isActive: boolean
}

export interface CoupeFactionEntry {
  factionId: string
  factionTitle: string
  factionColor: string
  score: number
  memberCount: number
  rank: number
}

export interface CoupeUserEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  factionId: string
  score: number
  rank: number
}

export interface CoupeMyBreakdown {
  userId: string
  lieuxAjoutes: number
  carnets: number
  photos: number
  plantages: number
  enigmes: number
  score: number
}

export interface CoupeState {
  season: CoupeSeason
  factions: CoupeFactionEntry[]
  topUsers: CoupeUserEntry[]
  myBreakdown: CoupeMyBreakdown | null
}

/** Barème — gardé en synchro avec la migration 023. Si tu modifies ici, modifie aussi la mig. */
export const COUPE_BAREME = {
  enigme: 1,
  plantage: 5,
  photo: 1,
  carnet: 3,
  lieuAjoute: 7,
} as const
