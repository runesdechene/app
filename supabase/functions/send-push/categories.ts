// Mapping centralisé des types de notifications V1 push.
// Tout type non listé = 'silent' (in-app uniquement, pas de push).

export type Category = 'important' | 'recap' | 'silent'

export const CATEGORY_BY_TYPE: Record<string, Category> = {
  daily_enigma_ready:       'important',
  expedition_message:       'important',
  place_taken_remote:       'important',
  place_taken_back_gps:     'important',
  place_reaffirmed:         'important',
  level_up_imminent:        'recap',
  weekly_new_places_recap:  'recap',
}

export function categoryOf(type: string): Category {
  return CATEGORY_BY_TYPE[type] ?? 'silent'
}
