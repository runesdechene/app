// apps/explore-web/src/lib/levelCalc.ts

import { LEVEL_CAP } from '../types/level'

/**
 * Calcule le niveau correspondant à une XP cumulée.
 * Doit matcher EXACTEMENT _level_from_xp() en DB :
 *   niv 1 = 0..4 XP, niv 2 = 5..12, niv 3 = 13..47
 *   niv N>=4 = 13 + 700 * (1.05^(N-3) - 1) cumul  [Calibration C, mig 050]
 */
export function levelFromXp(xp: number): number {
  if (xp == null || xp < 5) return 1
  if (xp < 13) return 2
  if (xp < 48) return 3
  const computed = 3 + Math.floor(Math.log(1 + (xp - 13) / 700) / Math.log(1.05))
  return Math.min(LEVEL_CAP, computed)
}

/**
 * XP cumulée nécessaire pour ATTEINDRE un niveau N.
 * Mirror de _xp_for_level() en DB.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  if (level === 2) return 5
  if (level === 3) return 13
  if (level >= LEVEL_CAP) return 6248
  return Math.round(13 + 700 * (Math.pow(1.05, level - 3) - 1))
}

/** XP restante pour passer au niveau suivant (0 si cap atteint). */
export function xpToNextLevel(currentXp: number): number {
  const lvl = levelFromXp(currentXp)
  if (lvl >= LEVEL_CAP) return 0
  return Math.max(0, xpForLevel(lvl + 1) - currentXp)
}
