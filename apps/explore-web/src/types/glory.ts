// V0.7 phase 3.5 — Refonte Gloire (cumul lifetime, même formule que la Coupe)
// Spec : voir migration 024_v07_glory_refonte.sql

export interface EnigmasByDifficulty {
  total: number
  veryEasy: number
  easy: number
  medium: number
  hard: number
}

export interface GloryState {
  /** Score Gloire pondéré par catégorie (somme des actions × points) */
  glory: number
  /** Compteurs bruts (informatifs, pour le récit) */
  lieuxExplores: number
  lieuxAjoutes: number
  carnets: number
  photos: number
  plantages: number
  enigmes: EnigmasByDifficulty
}

/** Erreur retournée par la RPC si non autorisé */
export interface GloryError {
  error: 'unauthorized'
}

export type GloryResult = GloryState | GloryError
