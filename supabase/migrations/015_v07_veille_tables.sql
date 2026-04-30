-- 015_v07_veille_tables.sql
-- WHY : V0.7 — système de Veille (Plantage de l'étendard) remplace l'influence cumulative.
-- Phase 1 : tables, indexes, soft transition seed depuis activity_log + place_explorers,
-- et neutralisation de la RPC place_influence_action (no-op) pour figer les données V0.5.
-- Modèle unifié : toute veille = une expédition (solo = expédition d'1 membre).
-- Q1=d : veilleur initial = dernier user avec interaction GPS sur le lieu (faction = actuelle).
-- Q2=a : ancien système figé, pas de DROP cette migration.
-- Spec : docs/superpowers/specs/2026-04-30-v07-veille-plantage.md
--
-- DEPRECATES (cleanup ultérieur via Graphify, pas dans cette migration) :
--   tables    : public.place_influence, public.user_place_influence
--   RPCs      : place_influence_action (neutralisée ici), propose_territory_name,
--               vote_territory_name, get_territory_votes, recalc_place_content_points,
--               _blob_dominant_faction, _user_blob_influence, claim_place
--   colonnes  : places.faction_id, places.claimed_by, places.claimed_at,
--               places.fortification_level, places.claimed_avatar_url

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.expeditions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  is_neutral  boolean NOT NULL DEFAULT false,
  faction_id  text REFERENCES public.factions(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expedition_members (
  expedition_id uuid REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id       text REFERENCES public.users(id) ON DELETE CASCADE,
  faction_id    text REFERENCES public.factions(id),
  PRIMARY KEY (expedition_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.place_veille (
  place_id      text PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  faction_id    text REFERENCES public.factions(id),
  is_neutral    boolean NOT NULL DEFAULT false,
  planted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_veille_faction_idx ON public.place_veille (faction_id) WHERE NOT is_neutral;

CREATE TABLE IF NOT EXISTS public.veille_history (
  id            bigserial PRIMARY KEY,
  place_id      text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id uuid REFERENCES public.expeditions(id) ON DELETE SET NULL,
  user_id       text REFERENCES public.users(id) ON DELETE SET NULL,
  faction_id    text REFERENCES public.factions(id),
  is_neutral    boolean NOT NULL DEFAULT false,
  planted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS veille_history_place_idx ON public.veille_history (place_id, planted_at DESC);
CREATE INDEX IF NOT EXISTS veille_history_user_idx  ON public.veille_history (user_id, planted_at DESC);

-- ============================================================
-- SOFT TRANSITION : seed depuis dernier visiteur GPS
-- Pour chaque lieu candidat, créer une expédition solo de 1 membre
-- et la poser comme veille active.
-- ============================================================

DO $$
DECLARE
  c record;
  v_exp_id uuid;
BEGIN
  FOR c IN
    WITH last_gps_per_place AS (
      SELECT place_id, actor_id AS user_id, MAX(created_at) AS last_at
      FROM public.activity_log
      WHERE type IN ('visit_gps', 'revisit_gps')
        AND place_id IS NOT NULL AND actor_id IS NOT NULL
      GROUP BY place_id, actor_id
    ),
    ranked AS (
      SELECT place_id, user_id, last_at,
             ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY last_at DESC) AS rk
      FROM last_gps_per_place
    ),
    fallback_explorers AS (
      SELECT pe.place_id, pe.user_id, pe.visited_at AS last_at
      FROM public.place_explorers pe
      WHERE pe.place_id NOT IN (SELECT place_id FROM ranked)
    )
    SELECT r.place_id, r.user_id, u.faction_id, r.last_at
    FROM ranked r JOIN public.users u ON u.id = r.user_id
    WHERE r.rk = 1 AND u.faction_id IS NOT NULL
    UNION ALL
    SELECT f.place_id, f.user_id, u.faction_id, f.last_at
    FROM fallback_explorers f JOIN public.users u ON u.id = f.user_id
    WHERE u.faction_id IS NOT NULL
  LOOP
    INSERT INTO public.expeditions(place_id, is_neutral, faction_id, created_at)
    VALUES (c.place_id, false, c.faction_id, c.last_at)
    RETURNING id INTO v_exp_id;

    INSERT INTO public.expedition_members(expedition_id, user_id, faction_id)
    VALUES (v_exp_id, c.user_id, c.faction_id);

    INSERT INTO public.place_veille(place_id, expedition_id, faction_id, is_neutral, planted_at)
    VALUES (c.place_id, v_exp_id, c.faction_id, false, c.last_at)
    ON CONFLICT (place_id) DO NOTHING;

    INSERT INTO public.veille_history(place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (c.place_id, v_exp_id, c.user_id, c.faction_id, false, c.last_at);
  END LOOP;
END $$;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT ON public.place_veille       TO authenticated, anon, service_role;
GRANT SELECT ON public.expeditions        TO authenticated, anon, service_role;
GRANT SELECT ON public.expedition_members TO authenticated, anon, service_role;
GRANT SELECT ON public.veille_history     TO authenticated, anon, service_role;

-- ============================================================
-- FREEZE V0.5 : neutraliser place_influence_action (no-op)
-- Garde le nom (pas de DROP) pour ne pas casser les clients V0.5
-- encore déployés. La RPC retourne un état stable sans toucher la DB.
-- DEPRECATES — RPC à droper au cleanup ultérieur.
-- ============================================================

-- Signature reprise EXACTEMENT de 001_baseline (sinon CREATE OR REPLACE crée un overload).
CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id text,
  p_place_id text,
  p_points integer,
  p_user_lat numeric DEFAULT NULL,
  p_user_lng numeric DEFAULT NULL,
  p_target_faction_id text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- V0.7 freeze : on ne touche plus place_influence ni user_place_influence.
  RETURN json_build_object(
    'error', 'system_frozen_v07',
    'message', 'Le système d''influence a été remplacé par la Veille (V0.7). Utilisez plant_flag.',
    'remainingStock', NULL,
    'placeInfluence', NULL
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.place_influence_action(text, text, integer, numeric, numeric, text) TO authenticated, anon, service_role;
