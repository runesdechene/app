-- 078_v07_phase5_schema.sql
-- WHY : Phase 5 (La Cour). Tables d'investissement diplomatique et colonnes
-- d'état "veilleur par influence" sur place_veille. Pas de RPCs métier ici
-- (mig 079). Pas de seed : les scores partent de zéro pour tout le monde,
-- conformément à la décision Uriel "drop pur, pas de conversion".

BEGIN;

-- ============================================================
-- TABLE place_court_action — journal append-only des investissements
-- ============================================================
-- Une ligne par action invest_crowns. Sert au leaderboard mécènes (cumulatif
-- à vie) et à la chronique du lieu (10 dernières actions).

CREATE TABLE IF NOT EXISTS public.place_court_action (
  id              bigserial PRIMARY KEY,
  place_id        text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expedition_id   uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  side            text NOT NULL CHECK (side IN ('defense', 'attack')),
  amount          integer NOT NULL CHECK (amount > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Pour leaderboard mécènes par lieu (top patrons).
CREATE INDEX IF NOT EXISTS place_court_action_place_user_idx
  ON public.place_court_action (place_id, user_id);

-- Pour chronique (10 dernières actions du lieu).
CREATE INDEX IF NOT EXISTS place_court_action_place_created_idx
  ON public.place_court_action (place_id, created_at DESC);

-- Pour calcul total Couronnes investies par user (titres Bourse Légère etc).
CREATE INDEX IF NOT EXISTS place_court_action_user_idx
  ON public.place_court_action (user_id);

-- ============================================================
-- TABLE place_court_score — agrégation incrémentale par (lieu, expé)
-- ============================================================
-- Évite de recalculer SUM(amount) à chaque lecture. Mise à jour incrémentale
-- dans invest_crowns. Reset (DELETE) au plantage GPS d'une autre expé ou
-- à la bascule.

CREATE TABLE IF NOT EXISTS public.place_court_score (
  place_id        text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id   uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  score           integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  last_action_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, expedition_id)
);

-- Pour query "menace haute sur un lieu donné" et "lieux où une expé attaque".
CREATE INDEX IF NOT EXISTS place_court_score_place_score_idx
  ON public.place_court_score (place_id, score DESC);

-- ============================================================
-- COLONNES place_veille — état "veilleur par influence"
-- ============================================================
-- by_influence : true si l'expé tient le lieu sans qu'aucun membre n'y soit
--                allé IRL depuis la bascule. Tant que ce flag est true, l'ancien
--                veilleur (= previous_expedition_id) peut reprendre le lieu
--                gratuitement par GPS (la marche prime sur l'or).
-- previous_expedition_id : pointe vers l'expé qui détenait place_veille AVANT
--                         la bascule par influence. Reset à NULL dès qu'un
--                         membre de la nouvelle expé plante IRL (consolidation).

ALTER TABLE public.place_veille
  ADD COLUMN IF NOT EXISTS by_influence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_expedition_id uuid REFERENCES public.expeditions(id) ON DELETE SET NULL;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT ON public.place_court_action TO authenticated, anon, service_role;
GRANT SELECT ON public.place_court_score  TO authenticated, anon, service_role;

COMMIT;
