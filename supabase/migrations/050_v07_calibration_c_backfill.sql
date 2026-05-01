-- 050_v07_calibration_c_backfill.sql
-- WHY : rééquilibrage V0.7 — Calibration C (validée Uriel 2026-05-01).
--   1. Découverte du brouillard = 0 XP (anti-farm — ce sera valorisé via mini-quêtes V0.8+)
--   2. Courbe niveau durcie : base 25 → 35 (coût(N→N+1) = 35 × 1.05^(N-3) pour N≥3)
--      Cumul cap 50 = ~6248 XP (au lieu de ~4467 avec ancienne base)
--   3. Backfill xp_total pour TOUS les users depuis 2026-03-01 (~2 mois — donne une
--      base juste aux actifs récents sans réécrire l'histoire pré-mars)
--
-- Sources d'XP (post-Calibration C) :
--   - Visite GPS d'un nouveau lieu : +3 (DISTINCT)
--   - Lieu ajouté (cartographier) : +20
--   - Carnet écrit : +5
--   - Photo ajoutée (par photo) : +1
--   - Plantage de bannière : +10
--   - Énigme correcte : +1/+1/+2/+3 selon difficulté (helper _enigma_score_weighted)
--   - Découverte du brouillard : 0 (no-op)

-- ============================================================
-- 1. Nouveaux _level_from_xp et _xp_for_level (base 35 au lieu de 25)
-- ============================================================
-- coût(N→N+1) = 35 × 1.05^(N-3) pour N>=3
-- cumul(N) = 13 + 700 × (1.05^(N-3) - 1)
-- inversion : N = 3 + floor(ln(1 + (xp - 13) / 700) / ln(1.05))

CREATE OR REPLACE FUNCTION public._level_from_xp(p_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_xp IS NULL OR p_xp < 5  THEN 1
    WHEN p_xp < 13                  THEN 2
    WHEN p_xp < 48                  THEN 3   -- niv 4 = 13 + 35 = 48
    ELSE LEAST(50, 3 + FLOOR(LN(1 + (p_xp - 13)::numeric / 700) / LN(1.05))::int)
  END;
$$;

CREATE OR REPLACE FUNCTION public._xp_for_level(p_level integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_level <= 1 THEN 0
    WHEN p_level = 2  THEN 5
    WHEN p_level = 3  THEN 13
    WHEN p_level >= 50 THEN 6248  -- cap atteint à ~6248 XP avec base 35
    ELSE (13 + 700 * (POWER(1.05, p_level - 3) - 1))::int
  END;
$$;

-- ============================================================
-- 2. _trg_xp_discovered_insert/delete : NO-OP (découverte = 0 XP)
-- L'INSERT dans places_discovered ne donne plus d'XP. La table reste utilisée
-- pour les compteurs de titres (Curieux/Explorateur/Arpenteur/Grand Voyageur)
-- et pour le rendu de la carte (brouillard).
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_discovered_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- No-op (Calibration C, mig 050) : découverte du brouillard ne donne plus d'XP.
  -- Sera valorisée via mini-quêtes journalières en V0.8+.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_discovered_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- No-op (Calibration C, mig 050)
  RETURN OLD;
END;
$$;

-- ============================================================
-- 3. Décale xp_epoch à 2026-03-01 pour symétrie backfill ↔ futures suppressions
-- ============================================================
UPDATE public.app_settings
SET value = extract(epoch from '2026-03-01'::timestamptz)::text
WHERE key = 'xp_epoch';

-- ============================================================
-- 4. Backfill xp_total pour tous les users
-- Recalcule l'XP gagnée depuis 2026-03-01 selon les coefficients Calibration C.
-- ============================================================
UPDATE public.users u SET xp_total = (
  -- Visites GPS (+3 par DISTINCT place_id depuis 2026-03-01)
  COALESCE((SELECT COUNT(DISTINCT place_id)::int * 3 FROM public.place_explorers pe
            WHERE pe.user_id = u.id AND pe.visited_at >= '2026-03-01'), 0)
  -- Lieux ajoutés (+20)
  + COALESCE((SELECT COUNT(*)::int * 20 FROM public.places p
              WHERE p.author_id = u.id AND p.created_at >= '2026-03-01'), 0)
  -- Carnets (+5)
  + COALESCE((SELECT COUNT(*)::int * 5 FROM public.place_contributions pc
              WHERE pc.user_id = u.id AND pc.type = 'carnet' AND pc.created_at >= '2026-03-01'), 0)
  -- Photos (+1 par photo dans images[] + fallback image_url)
  + COALESCE((SELECT SUM(
       COALESCE(jsonb_array_length(pc.images), 0)
       + CASE WHEN (pc.images IS NULL OR jsonb_array_length(pc.images) = 0)
                AND pc.image_url IS NOT NULL AND pc.image_url != ''
              THEN 1 ELSE 0 END
     )::int FROM public.place_contributions pc
     WHERE pc.user_id = u.id AND pc.type = 'photo' AND pc.created_at >= '2026-03-01'), 0)
  -- Plantages (+10)
  + COALESCE((SELECT COUNT(*)::int * 10 FROM public.veille_history vh
              WHERE vh.user_id = u.id AND vh.planted_at >= '2026-03-01'), 0)
  -- Énigmes pondérées (helper)
  + COALESCE(public._enigma_score_weighted(u.id, '2026-03-01'::timestamptz, now()), 0)
  -- (Découverte = 0, pas comptée)
);
