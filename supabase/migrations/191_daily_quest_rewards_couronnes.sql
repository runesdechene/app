-- 191_daily_quest_rewards_couronnes.sql
-- Les Défis du jour récompensent en COURONNES (monnaie visible du jeu), pas en "XP/Expérience"
-- (le leveling XP n'est pas surfacé aux joueurs comme une récompense). reward_xp -> 0,
-- reward_couronnes défini par quête. claim_daily_quest crédite déjà reward_couronnes (cap 500).
UPDATE public.quest_templates SET
  reward_couronnes = CASE id
    WHEN 'daily_moisson'         THEN 2
    WHEN 'daily_brouillard'      THEN 2
    WHEN 'daily_enigme'          THEN 2
    WHEN 'daily_pool_discover3'  THEN 3
    WHEN 'daily_pool_discover5'  THEN 5
    WHEN 'daily_pool_moisson3'   THEN 3
    WHEN 'daily_pool_enigme'     THEN 2
    ELSE reward_couronnes
  END,
  reward_xp = 0
WHERE type = 'daily';
