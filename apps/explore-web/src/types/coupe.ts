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

export interface CoupeEnigmasByDifficulty {
  total: number
  veryEasy: number
  easy: number
  medium: number
  hard: number
}

export interface CoupeMyBreakdown {
  userId: string
  /** V0.7 phase 3.5 : ajout des lieux distincts visités GPS pendant la saison */
  lieuxExplores: number
  lieuxAjoutes: number
  carnets: number
  photos: number
  plantages: number
  /** V0.7 phase 3.5 : breakdown par difficulté pour le récit
      (la difficulté ne pèse plus dans le score, juste informatif) */
  enigmes: CoupeEnigmasByDifficulty
  score: number
}

export interface CoupeState {
  season: CoupeSeason
  factions: CoupeFactionEntry[]
  topUsers: CoupeUserEntry[]
  myBreakdown: CoupeMyBreakdown | null
}

/** Barème — gardé en synchro avec les migrations 023 + 024. Si tu modifies ici,
 *  modifie aussi les migs. Énigmes : +1 fixe quelle que soit la difficulté
 *  (anti-triche : on n'incite pas à chercher en ligne pour les hard). */
export const COUPE_BAREME = {
  visite: 1,        // visite GPS d'un nouveau lieu (DISTINCT place_id)
  enigme: 1,        // énigme résolue (toute difficulté)
  photo: 1,
  carnet: 3,
  plantage: 5,
  lieuAjoute: 7,
} as const
