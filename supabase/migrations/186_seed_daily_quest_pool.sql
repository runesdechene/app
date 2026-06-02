-- 186_seed_daily_quest_pool.sql
-- Bibliothèque de Défis perso (type='daily'), piochés en lot déterministe par get_today_quests_state.
-- tracker_kind existants (mig 056) : discoveries, enigma_attempt, moisson_claims, social_action.
INSERT INTO public.quest_templates
  (id, type, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes, display_order, active)
VALUES
  ('daily_pool_discover3', 'daily', 'Lève le brouillard sur 3 terres inconnues', '🌫️', 'discoveries', 3, 6, 0, 10, true),
  ('daily_pool_discover5', 'daily', 'Révèle 5 lieux à la communauté', '🗺️', 'discoveries', 5, 10, 0, 11, true),
  ('daily_pool_moisson3',  'daily', 'Récolte la moisson de 3 fiefs', '🪙', 'moisson_claims', 3, 5, 0, 12, true),
  ('daily_pool_enigme',    'daily', 'Affronte l''énigme du jour', '🗝️', 'enigma_attempt', 1, 5, 0, 13, true),
  ('daily_pool_social',    'daily', 'Salue un compagnon de route', '👋', 'social_action', 1, 3, 0, 14, true)
ON CONFLICT (id) DO UPDATE SET
  wording = EXCLUDED.wording, icon = EXCLUDED.icon, threshold = EXCLUDED.threshold,
  reward_xp = EXCLUDED.reward_xp, display_order = EXCLUDED.display_order, active = true;
