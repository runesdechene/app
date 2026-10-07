// La catégorie push de chaque type de notification de la V2 (`_notification_v2`, migration 421,
// plus `mise_a_jour`). Un type absent est 'silent' : rien n'est envoyé (les types de la V1 — énigme
// du jour, expéditions, Cour, articles — depuis la bascule du 07/10/2026).
// 'important' suit `users.push_important_enabled`, 'recap' suit `push_recap_enabled`.

export type Category = 'important' | 'recap' | 'silent'

export const CATEGORY_BY_TYPE: Record<string, Category> = {
  new_comment: 'important',
  comment_reply: 'important',
  new_carnet: 'important',
  coeur_mot: 'important',
  like_carnet: 'important',
  like_contribution: 'important',
  description_edited: 'important',
  lieu_modifie: 'important',
  new_photo: 'important',
  place_position_edited: 'important',
  mention: 'important',
  salut: 'important',
  demande_compagnie: 'important',
  demande_acceptee: 'important',
  mise_a_jour: 'important',
  exploration: 'recap',
  milestone_exploration: 'recap',
  milestone_vues: 'recap',
  milestone_likes: 'recap',
}

export function categoryOf(type: string): Category {
  return CATEGORY_BY_TYPE[type] ?? 'silent'
}
