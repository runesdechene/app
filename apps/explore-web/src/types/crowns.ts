// V0.7 phase 2 — Couronnes de Chêne
// Système de récolte quotidienne sur les lieux veillés.
// Spec : voir migration 021_v07_crowns.sql

export interface HarvestablePlace {
  placeId: string
  /** 1 si solo, 2 si expé (≥2 membres) */
  gain: 1 | 2
  /** ISO timestamp — moment où le coffre est devenu récoltable */
  eligibleAt: string
}

export interface CrownsState {
  balance: number
  capped: boolean
  harvestable: HarvestablePlace[]
}

export interface HarvestSuccess {
  success: true
  placeId: string
  gain: number
  balance: number
  harvestedAt: string
}

export interface HarvestError {
  error: 'unauthorized' | 'not_veilled' | 'not_member' | 'too_soon' | 'stock_full'
  eligibleAt?: string
  balance?: number
}

export type HarvestResult = HarvestSuccess | HarvestError
