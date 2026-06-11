// Helpers d'affichage pour la progression des titres jouables.
// Extraits de PlayerProfileModal pendant le sprint Purification (B15, mai 2026).

/** Labels FR pour chaque stat utilisée dans les conditions de titres.
 *  Source des stats : `get_all_player_titles` (mig 082, 045 et suivantes). */
export const STAT_LABELS: Record<string, string> = {
  discoveries: 'découvertes',
  claims: 'protections',
  notoriety: 'gloire',
  likes: 'likes',
  fortifications: 'fortifications',
  places_added: 'lieux ajoutés',
  level: 'niveau',
  places_visited: 'lieux visités',
  enigma_score: 'pts énigmes',
  plantages: 'plantages',
  mecenat_total: 'Couronnes investies',
  mecenat_top1_count: 'mécénats principaux',
}

/** Condition d'obtention d'un titre : seuil min sur une stat OU rang à atteindre. */
export interface TitleCondition {
  stat: string
  min?: number
  rank?: number
}

/**
 * Formate la progression d'un joueur vers une condition de titre.
 * Renvoie `null` si la condition est nulle (titre toujours débloqué) ou mal formée.
 *
 * Exemples :
 *   - { stat: 'discoveries', min: 10 } + playerStats={discoveries: 7}
 *     → "7 / 10 découvertes"
 *   - { stat: 'notoriety', rank: 3 } → "Top 3 gloire"
 */
export function formatTitleProgress(
  condition: TitleCondition | undefined,
  playerStats: Record<string, number>,
): string | null {
  if (!condition) return null
  const stat = condition.stat
  const current = playerStats[stat] ?? 0
  if (condition.min != null) {
    return `${current} / ${condition.min} ${STAT_LABELS[stat] ?? stat}`
  }
  if (condition.rank != null) {
    return `Top ${condition.rank} ${STAT_LABELS[stat] ?? stat}`
  }
  return null
}
