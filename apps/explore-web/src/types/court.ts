// Types client-side pour La Cour (V0.7 phase 5).
// Voir docs/superpowers/specs/2026-05-05-v07-phase5-la-cour-design.md

export type CourtStatus = 'paisible' | 'convoite' | 'sous_pression' | 'en_siege' | 'vacant'

export type CourtSide = 'defense' | 'attack'

export interface ExpeditionMember {
  userId: string
  displayName: string
}

export interface CourtVeilleur {
  expeditionId: string
  name: string
  planted_at: string
  byInfluence: boolean
  /** V086 — leader de l'expédition (user mis en avant côté UX) */
  leaderName: string
  leaderUserId: string | null
  /** V088 — avatar du leader */
  leaderAvatarUrl: string | null
  factionId: string | null
  factionColor: string | null
  factionPattern: string | null
  members: ExpeditionMember[]
}

export interface CourtThreat {
  expeditionId: string
  name: string
  score: number
}

export interface Patron {
  userId: string
  displayName: string
  total: number
  /** V089 — décomposition Soutien (defense) vs Influence (attack) */
  defenseTotal: number
  attackTotal: number
  /** V090 — faction du mécène pour afficher l'icône faction sur la ligne */
  factionId: string | null
  factionColor: string | null
  factionPattern: string | null
}

export interface ChronicleEntry {
  ts: string
  actorName: string
  expeditionName: string
  side: CourtSide
  amount: number
}

export interface CourtCallerContext {
  balance: number
  isMemberOfVeilleur: boolean
  challengerExpeditions: string[]
  userTotalOnPlace: number
}

export interface PlaceCourtState {
  /** V094 — true si le lieu n'a pas de veilleur (jamais planté ou abandonné) */
  vacant: boolean
  /** Null si vacant */
  veilleur: CourtVeilleur | null
  scoreVeilleur: number
  threats: CourtThreat[]
  menaceHaute: number | null
  /** Score à dépasser : score veilleur si veillé, 50 si vacant */
  scoreToBeat: number | null
  topPatrons: Patron[]
  chronicle: ChronicleEntry[]
  status: CourtStatus
  callerContext: CourtCallerContext | null
}

export interface InvestCrownsResult {
  success: boolean
  side: CourtSide
  newScore: number
  balance: number
  basculed: boolean
  basculedExpeditionId: string | null
}

export interface CreateChallengerExpeditionResult {
  success: boolean
  expeditionId: string
  reused: boolean
}
