// apps/explore-web/src/types/level.ts

/** État du niveau du joueur, mirror du JSON exposé par get_player_profile. */
export interface LevelState {
  level: number              // 1..50
  xpTotal: number            // xp cumulée
  xpToNextLevel: number      // xp restante pour atteindre level + 1
  xpForNextLevel: number     // xp totale nécessaire pour level + 1
  veteranFirstEra: boolean   // badge vétéran présent au switch
}

/** Résultat d'une action qui peut faire monter de niveau. */
export interface LevelDelta {
  xpDelta: number            // xp gagnée par l'action
  levelBefore: number        // niveau avant
  levelAfter: number         // niveau après
}

export const LEVEL_CAP = 50
