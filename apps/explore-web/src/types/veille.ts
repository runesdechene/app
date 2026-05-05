// Types V0.7 — système de Veille (Plantage de l'étendard)
// Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md

export interface VeilleMember {
  userId: string
  displayName: string
  avatarUrl: string | null
  factionId: string
}

export type PlaceVeille =
  | { vacant: true }
  | {
      vacant: false
      isNeutral: boolean
      factionId: string | null     // null si neutral
      expeditionId: string
      plantedAt: string
      members: VeilleMember[]      // toujours ≥ 1 entrée (solo = 1)
    }

export interface NearbyPlanter {
  userId: string
  displayName: string
  avatarUrl: string | null
  factionId: string
  factionColor: string | null
}

export interface PlantFlagSuccess {
  success: true
  placeId: string
  isNeutral: boolean
  factionId: string | null
  expeditionId: string
  members: VeilleMember[]
  plantedAt: string
}

export interface PlantFlagError {
  error: 'unauthorized' | 'no_faction' | 'place_not_found' | 'too_far' | 'cooldown' | 'already_yours'
  distanceKm?: number
  remainingHours?: number
  cooldownHours?: number
  expeditionId?: string
  placeTitle?: string
}

export type PlantFlagResult = PlantFlagSuccess | PlantFlagError

export interface MapVeilleMember {
  userId: string
  displayName: string
  avatarUrl: string | null
  factionId: string
  factionColor: string | null
  factionPattern: string | null
}

export interface MapVeille {
  placeId: string
  factionId: string | null
  isNeutral: boolean
  plantedAt: string
  members: MapVeilleMember[]
}
