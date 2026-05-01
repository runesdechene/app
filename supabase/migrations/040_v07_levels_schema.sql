-- 040_v07_levels_schema.sql
-- WHY : Phase 1 du système Niveaux V0.7.
--   - Ajoute xp_total (compteur effort cumulé post-epoch, jamais affiché brut)
--   - Ajoute veteran_first_era (badge attribué aux contributeurs pré-switch)
--   - Stocke xp_epoch dans app_config (date du switch, secondes UTC)
--   - Crée _level_from_xp (function pure pour dériver le niveau)
--
-- Cette mig est SAFE : aucun calcul ni trigger encore. Juste le schéma.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS xp_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS veteran_first_era boolean NOT NULL DEFAULT false;

-- Table de configuration globale de l'app (clé/valeur)
CREATE TABLE IF NOT EXISTS public.app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- xp_epoch = timestamp d'application de cette mig (utilisé par les triggers
-- pour ignorer l'historique pré-switch)
INSERT INTO public.app_config (key, value)
VALUES ('xp_epoch', extract(epoch from now())::text)
ON CONFLICT (key) DO NOTHING;

-- Function pure : XP cumulée → Niveau (cap 50).
-- Régime onboarding (niv 1-3 hardcodé) :
--   1→2 = 5 XP, 2→3 = 8 XP, donc cumul atteint :
--   niv 1 = 0 XP, niv 2 = 5 XP, niv 3 = 13 XP
-- Régime sérieux (niv 3+) : coût(N→N+1) = 25 × 1.05^(N-3)
--   cumul(N) = 13 + 500 × (1.05^(N-3) - 1)
--   inversion : N = 3 + floor(ln(1 + (xp - 13) / 500) / ln(1.05))
CREATE OR REPLACE FUNCTION public._level_from_xp(p_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_xp IS NULL OR p_xp < 5  THEN 1
    WHEN p_xp < 13                  THEN 2
    WHEN p_xp < 38                  THEN 3
    ELSE LEAST(50, 3 + FLOOR(LN(1 + (p_xp - 13)::numeric / 500) / LN(1.05))::int)
  END;
$$;

GRANT EXECUTE ON FUNCTION public._level_from_xp(integer) TO authenticated, anon, service_role;

-- Function pure : Niveau N → XP cumulée nécessaire pour ATTEINDRE ce niveau.
-- Utilisée par le front pour calculer xpToNextLevel.
CREATE OR REPLACE FUNCTION public._xp_for_level(p_level integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_level <= 1 THEN 0
    WHEN p_level = 2  THEN 5
    WHEN p_level = 3  THEN 13
    WHEN p_level >= 50 THEN 4467  -- cap atteint à ~4467 XP (cumul niveau 50)
    ELSE (13 + 500 * (POWER(1.05, p_level - 3) - 1))::int
  END;
$$;

GRANT EXECUTE ON FUNCTION public._xp_for_level(integer) TO authenticated, anon, service_role;
