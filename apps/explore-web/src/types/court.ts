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
  /** V0.7.6 (8/05) — vrai avatar du joueur (null si pas d'avatar défini) */
  avatarUrl: string | null
  total: number
  /** V089 — décomposition Soutien (defense) vs Influence (attack) */
  defenseTotal: number
  attackTotal: number
  /** V090 — faction du mécène pour afficher l'icône faction sur la ligne */
  factionId: string | null
  factionColor: string | null
  factionPattern: string | null
}

/** V0.8.23 — un mécène qui finance un challenger (hors le challenger lui-même). */
export interface ChallengerSupporter {
  userId: string
  displayName: string
  amount: number
}

export interface Challenger {
  userId: string
  displayName: string
  avatarUrl: string | null
  score: number
  factionColor: string | null
  factionPattern: string | null
  /** Expé challenger du user sur ce lieu — passée telle quelle à invest_crowns.
   *  Null seulement dans un cas anormal (challenger sans expé) → bouton désactivé. */
  expeditionId: string | null
  /** V0.8.23 — mécènes qui soutiennent cette offensive (hors le challenger lui-même),
   *  triés par montant décroissant. Affichés en sous-liste « ↳ Soutiens ». */
  supporters: ChallengerSupporter[]
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
  /** V0.7.6 (8/05) — bonus IRL "faveur" du plant_flag (50 + 30×membres-1, capé).
   *  0 si by_influence (pas de bonus). Permet à CourtTensionBar de séparer
   *  visuellement la part "gratos par plantage" de la part "investie". */
  defenseFavorPoints: number
  /** V0.7.6 — Couronnes réellement investies en défense par l'expé veilleur. */
  defenseInvested: number
  threats: CourtThreat[]
  menaceHaute: number | null
  /** Score à dépasser : score veilleur si veillé, 50 si vacant */
  scoreToBeat: number | null
  topPatrons: Patron[]
  challengers: Challenger[]
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
