# V0.5 — De la Conquête à l'Influence — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le système claim/fortify par un système d'influence multi-Héritage, ajouter les fiches de lieu collaboratives, l'énigme quotidienne, et restructurer les ressources (Gloire = Exploration + Érudition).

**Architecture:** Migration incrémentale en 6 phases déployables indépendamment. Chaque phase ajoute sans casser — les anciennes RPCs restent fonctionnelles jusqu'à la phase de cleanup. La DB est live, donc chaque migration est additive d'abord, destructive en dernier.

**Tech Stack:** Supabase (PostgreSQL RPCs, SECURITY DEFINER) · React 18 + TypeScript strict · Zustand · MapLibre GL JS · Vite 5 · pnpm

**Spec de référence :** `\\EGIDE\Runes de Chêne\👑 LA CITADELLE\📱 L'application (La Carte)\📐 SPEC V0.5 — De la Conquête à l'Influence.md`

---

## Vue d'ensemble des phases

| Phase | Thème | Risque DB | Déployable seul ? |
|-------|-------|-----------|-------------------|
| 1 | Nouvelles tables & colonnes (additif pur) | Zéro | Oui — invisible côté front |
| 2 | Nouvelles RPCs (influence, énigme, contributions) | Zéro | Oui — appelées par le nouveau front |
| 3 | Frontend — Système d'influence + profil | Nul | Oui — remplace claim/fortify côté UI |
| 4 | Frontend — Fiches collaboratives + énigme | Nul | Oui — nouvelles features |
| 5 | Hub — Gestion énigmes, settings, cleanup admin | Nul | Oui |
| 6 | Migration données + cleanup (suppression ancien système) | Modéré | Oui — dernière étape |

---

## Phase 1 : Foundation Database (additif pur — zéro risque)

> On crée les nouvelles tables et colonnes. On ne touche à RIEN d'existant. L'app continue de tourner normalement.

---

### Task 1 : Nouvelles colonnes users

**Files:**
- Create: `supabase/migrations/195_v05_users_new_columns.sql`
- Archive: `.archives/migrations/195_v05_users_new_columns.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 195_v05_users_new_columns.sql
-- V0.5 : ajout exploration_points, erudition_points, influence_stock
-- Additif pur — ne modifie aucune colonne existante

ALTER TABLE users ADD COLUMN IF NOT EXISTS exploration_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS erudition_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS influence_stock INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.exploration_points IS 'Rang terrain permanent. +N par découverte, ajout lieu, visite GPS, photo, description.';
COMMENT ON COLUMN users.erudition_points IS 'Rang savoir permanent. +N par énigme (quotidienne ou de lieu).';
COMMENT ON COLUMN users.influence_stock IS 'Stock d influence dépensable sur les lieux. Gagné via énigmes, contributions, visites.';

-- Index pour le leaderboard
CREATE INDEX IF NOT EXISTS idx_users_glory ON users ((exploration_points + erudition_points) DESC);
```

- [ ] **Step 2: Copier dans .archives/migrations/**

- [ ] **Step 3: Appliquer sur Supabase (live)**

```bash
# Depuis le dashboard Supabase > SQL Editor, coller et exécuter
# OU via CLI :
supabase db push
```

- [ ] **Step 4: Vérifier**

```sql
SELECT id, exploration_points, erudition_points, influence_stock
FROM users LIMIT 5;
```
Expected: 3 nouvelles colonnes à 0 pour tous les users existants.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/195_v05_users_new_columns.sql .archives/migrations/195_v05_users_new_columns.sql
git commit -m "feat: add exploration_points, erudition_points, influence_stock to users (V0.5)"
```

---

### Task 2 : Table place_influence

**Files:**
- Create: `supabase/migrations/196_v05_place_influence.sql`
- Archive: `.archives/migrations/196_v05_place_influence.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 196_v05_place_influence.sql
-- V0.5 : influence multi-Héritage par lieu

CREATE TABLE IF NOT EXISTS place_influence (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  faction_id VARCHAR(255) NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  placed_points INT NOT NULL DEFAULT 0,        -- influence placée (décroît)
  content_points INT NOT NULL DEFAULT 0,       -- influence de contenu (permanent)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, faction_id)
);

CREATE INDEX IF NOT EXISTS idx_place_influence_place ON place_influence(place_id);
CREATE INDEX IF NOT EXISTS idx_place_influence_faction ON place_influence(faction_id);

COMMENT ON TABLE place_influence IS 'Influence par Héritage sur chaque lieu. placed_points décroît (-1/semaine), content_points est permanent.';

-- RLS : tout le monde peut lire, seules les RPCs modifient
ALTER TABLE place_influence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "place_influence_select" ON place_influence FOR SELECT USING (true);
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

```sql
SELECT * FROM place_influence LIMIT 1;
-- Expected: table vide, 0 rows
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/196_v05_place_influence.sql .archives/migrations/196_v05_place_influence.sql
git commit -m "feat: create place_influence table (V0.5 multi-heritage influence)"
```

---

### Task 3 : Table place_contributions

**Files:**
- Create: `supabase/migrations/197_v05_place_contributions.sql`
- Archive: `.archives/migrations/197_v05_place_contributions.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 197_v05_place_contributions.sql
-- V0.5 : contributions collaboratives sur les lieux (pages de carnet, photos, infos)

CREATE TABLE IF NOT EXISTS place_contributions (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  faction_id VARCHAR(255) NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('carnet', 'photo', 'accessibility', 'season', 'warning')),
  content TEXT,                        -- texte (carnet, info)
  image_url TEXT,                      -- URL image (photo)
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),  -- note en étoiles (NULL si pas de note)
  votes_up INT NOT NULL DEFAULT 0,
  votes_down INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id, type)      -- 1 contribution par type par user par lieu
);

CREATE INDEX IF NOT EXISTS idx_contributions_place ON place_contributions(place_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON place_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_votes ON place_contributions(place_id, type, votes_up DESC);

-- Table de votes (1 vote par user par contribution)
CREATE TABLE IF NOT EXISTS contribution_votes (
  id SERIAL PRIMARY KEY,
  contribution_id INT NOT NULL REFERENCES place_contributions(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),  -- -1 = down, +1 = up
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contribution_id, user_id)
);

-- RLS
ALTER TABLE place_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contributions_select" ON place_contributions FOR SELECT USING (true);
CREATE POLICY "contributions_insert" ON place_contributions FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "contributions_update" ON place_contributions FOR UPDATE USING (auth.uid()::TEXT = user_id);

ALTER TABLE contribution_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select" ON contribution_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON contribution_votes FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/197_v05_place_contributions.sql .archives/migrations/197_v05_place_contributions.sql
git commit -m "feat: create place_contributions and contribution_votes tables (V0.5)"
```

---

### Task 4 : Table place_explorers + place_ratings + place_wishlist

**Files:**
- Create: `supabase/migrations/198_v05_place_explorers_ratings_wishlist.sql`
- Archive: `.archives/migrations/198_v05_place_explorers_ratings_wishlist.sql`

- [ ] **Step 1: ��crire la migration**

```sql
-- 198_v05_place_explorers_ratings_wishlist.sql
-- V0.5 : Hall of Fame (explorateurs GPS), notes, wishlist

-- Explorateurs = joueurs vérifiés GPS sur un lieu
CREATE TABLE IF NOT EXISTS place_explorers (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_explorers_place ON place_explorers(place_id);

-- Notes en étoiles (réservées aux explorateurs)
CREATE TABLE IF NOT EXISTS place_ratings (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_place ON place_ratings(place_id);

-- Wishlist "Je veux y aller"
CREATE TABLE IF NOT EXISTS place_wishlist (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON place_wishlist(user_id);

-- RLS pour les 3 tables
ALTER TABLE place_explorers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "explorers_select" ON place_explorers FOR SELECT USING (true);

ALTER TABLE place_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_select" ON place_ratings FOR SELECT USING (true);
CREATE POLICY "ratings_upsert" ON place_ratings FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "ratings_update" ON place_ratings FOR UPDATE USING (auth.uid()::TEXT = user_id);

ALTER TABLE place_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_select" ON place_wishlist FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "wishlist_insert" ON place_wishlist FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "wishlist_delete" ON place_wishlist FOR DELETE USING (auth.uid()::TEXT = user_id);
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/198_v05_place_explorers_ratings_wishlist.sql .archives/migrations/198_v05_place_explorers_ratings_wishlist.sql
git commit -m "feat: create place_explorers, place_ratings, place_wishlist tables (V0.5)"
```

---

### Task 5 : Tables énigmes

**Files:**
- Create: `supabase/migrations/199_v05_enigmas.sql`
- Archive: `.archives/migrations/199_v05_enigmas.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 199_v05_enigmas.sql
-- V0.5 : énigmes quotidiennes + énigmes de lieu

CREATE TABLE IF NOT EXISTS enigmas (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('daily', 'place')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  heritage_id VARCHAR(255) REFERENCES factions(id),  -- NULL = toutes factions
  place_tag TEXT,                                      -- NULL = pas lié à un tag de lieu
  lore_text TEXT NOT NULL,                             -- 2 lignes de contexte historique
  question TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('qcm', 'free')),
  choices JSONB,                                       -- ["choix1","choix2","choix3","choix4"] pour QCM
  answer TEXT NOT NULL,                                -- réponse correcte
  explanation TEXT NOT NULL,                            -- explication affichée après réponse
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enigmas_type_active ON enigmas(type, active);
CREATE INDEX IF NOT EXISTS idx_enigmas_daily ON enigmas(type, difficulty) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_enigmas_place_tag ON enigmas(place_tag) WHERE type = 'place' AND active = TRUE;

-- Historique des réponses (1 par jour par user pour les daily)
CREATE TABLE IF NOT EXISTS enigma_responses (
  id SERIAL PRIMARY KEY,
  enigma_id INT NOT NULL REFERENCES enigmas(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_given TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  influence_gained INT NOT NULL DEFAULT 0,
  erudition_gained INT NOT NULL DEFAULT 0,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enigma_responses_user_date ON enigma_responses(user_id, responded_at DESC);

-- Vue pour savoir si le joueur a déjà répondu aujourd'hui
CREATE OR REPLACE VIEW daily_enigma_status AS
SELECT
  er.user_id,
  er.responded_at::DATE AS response_date,
  er.correct,
  er.enigma_id
FROM enigma_responses er
JOIN enigmas e ON e.id = er.enigma_id
WHERE e.type = 'daily';

-- RLS
ALTER TABLE enigmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enigmas_select" ON enigmas FOR SELECT USING (active = TRUE);

ALTER TABLE enigma_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "responses_select" ON enigma_responses FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "responses_insert" ON enigma_responses FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/199_v05_enigmas.sql .archives/migrations/199_v05_enigmas.sql
git commit -m "feat: create enigmas and enigma_responses tables (V0.5 daily enigma)"
```

---

### Task 6 : Nouveaux app_settings pour V0.5

**Files:**
- Create: `supabase/migrations/200_v05_app_settings.sql`
- Archive: `.archives/migrations/200_v05_app_settings.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 200_v05_app_settings.sql
-- V0.5 : settings pour le système d'influence et les énigmes

INSERT INTO app_settings (key, value) VALUES
  -- Influence
  ('influence_max_remote_per_day', '5'),          -- max points placables à distance par jour
  ('influence_decay_per_week', '1'),              -- decay hebdomadaire des placed_points
  ('influence_visit_gps', '10'),                  -- influence gagnée par visite GPS
  ('influence_add_place', '25'),                  -- influence gagnée en ajoutant un lieu
  ('influence_add_photo', '5'),                   -- influence gagnée en ajoutant une photo
  ('influence_add_carnet', '10'),                 -- influence gagnée en ajoutant une page de carnet
  ('influence_per_vote', '1'),                    -- influence permanente par vote reçu

  -- Exploration
  ('exploration_visit_gps', '2'),
  ('exploration_add_place', '5'),
  ('exploration_add_photo', '1'),
  ('exploration_add_carnet', '1'),

  -- Érudition
  ('erudition_add_carnet', '1'),
  ('erudition_enigma_wrong', '1'),                -- érudition même si mauvaise réponse

  -- Énigme quotidienne (bonne réponse)
  ('enigma_influence_easy', '3'),
  ('enigma_influence_medium', '4'),
  ('enigma_influence_hard', '5'),
  ('enigma_erudition_easy', '1'),
  ('enigma_erudition_medium', '2'),
  ('enigma_erudition_hard', '3'),

  -- Énigme de lieu
  ('enigma_place_influence_base', '2'),
  ('enigma_place_influence_per_diff', '1'),
  ('enigma_place_erudition_base', '2'),
  ('enigma_place_erudition_per_diff', '1')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

```sql
SELECT key, value FROM app_settings WHERE key LIKE 'influence_%' OR key LIKE 'exploration_%' OR key LIKE 'erudition_%' OR key LIKE 'enigma_%';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/200_v05_app_settings.sql .archives/migrations/200_v05_app_settings.sql
git commit -m "feat: add V0.5 app_settings (influence, exploration, erudition, enigma)"
```

---

## Phase 2 : Nouvelles RPCs

> Toutes les nouvelles fonctions. Les anciennes (claim_place, fortify_place) restent en place — on ne casse rien.

---

### Task 7 : RPC place_influence (placer de l'influence)

**Files:**
- Create: `supabase/migrations/201_v05_rpc_place_influence.sql`
- Archive: `.archives/migrations/201_v05_rpc_place_influence.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 201_v05_rpc_place_influence.sql
-- V0.5 : Placer de l'influence sur un lieu

CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id TEXT,
  p_place_id TEXT,
  p_points INT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_stock INT;
  v_is_gps BOOLEAN := FALSE;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_max_remote INT;
  v_today_remote INT;
  v_actual_points INT;
BEGIN
  -- Récupérer faction et stock du joueur
  SELECT faction_id, influence_stock INTO v_faction_id, v_stock
  FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  IF v_stock < p_points OR p_points <= 0 THEN
    RETURN json_build_object('error', 'not_enough_influence', 'stock', v_stock);
  END IF;

  -- Vérifier distance (GPS = sur place ?)
  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_is_gps := v_distance_km < 0.1;  -- < 100m = sur place
  END IF;

  IF NOT v_is_gps THEN
    -- À distance : limité à max_remote_per_day
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_max_remote_per_day'), 5)
    INTO v_max_remote;

    -- Compter ce qui a été placé aujourd'hui à distance (via activity_log)
    SELECT COALESCE(SUM((data->>'points')::INT), 0) INTO v_today_remote
    FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'place_influence'
      AND (data->>'remote')::BOOLEAN = TRUE
      AND created_at::DATE = CURRENT_DATE;

    v_actual_points := LEAST(p_points, v_max_remote - v_today_remote);
    IF v_actual_points <= 0 THEN
      RETURN json_build_object('error', 'daily_remote_limit', 'remaining', GREATEST(0, v_max_remote - v_today_remote));
    END IF;
  ELSE
    v_actual_points := p_points;  -- Sur place : pas de limite
  END IF;

  -- Déduire du stock
  UPDATE users SET influence_stock = influence_stock - v_actual_points
  WHERE id = p_user_id;

  -- Ajouter l'influence sur le lieu pour cette faction
  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_actual_points, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_actual_points,
               updated_at = NOW();

  -- Log
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('place_influence', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object('points', v_actual_points, 'remote', NOT v_is_gps, 'gps', v_is_gps));

  -- Retourner l'état
  RETURN json_build_object(
    'success', true,
    'pointsPlaced', v_actual_points,
    'remainingStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'gps', v_is_gps,
    'placeInfluence', (
      SELECT json_agg(json_build_object(
        'factionId', pi.faction_id,
        'placed', pi.placed_points,
        'content', pi.content_points,
        'total', pi.placed_points + pi.content_points
      ))
      FROM place_influence pi WHERE pi.place_id = p_place_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_influence_action(TEXT, TEXT, INT, NUMERIC, NUMERIC) TO authenticated;
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/201_v05_rpc_place_influence.sql .archives/migrations/201_v05_rpc_place_influence.sql
git commit -m "feat: add place_influence_action RPC (V0.5)"
```

---

### Task 8 : RPC visit_place_gps (visite GPS → explorateur + influence + exploration)

**Files:**
- Create: `supabase/migrations/202_v05_rpc_visit_place.sql`
- Archive: `.archives/migrations/202_v05_rpc_visit_place.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 202_v05_rpc_visit_place.sql
-- V0.5 : Enregistrer une visite GPS, donner influence + exploration

CREATE OR REPLACE FUNCTION public.visit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_already_visited BOOLEAN;
  v_influence_gain INT;
  v_exploration_gain INT;
  v_new_influence_stock INT;
  v_new_exploration INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Vérifier proximité
  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  -- Déjà visité ?
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_visited;

  IF v_already_visited THEN
    RETURN json_build_object('error', 'already_visited');
  END IF;

  -- Lire les gains depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_visit_gps'), 10) INTO v_influence_gain;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 2) INTO v_exploration_gain;

  -- Enregistrer comme explorateur
  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  -- Donner influence stock + exploration au joueur
  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id
  RETURNING influence_stock, exploration_points INTO v_new_influence_stock, v_new_exploration;

  -- Ajouter de l'influence de contenu sur le lieu pour la faction du visiteur
  INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_exploration_gain, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET content_points = place_influence.content_points + v_exploration_gain,
               updated_at = NOW();

  -- Log
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('visit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object('influenceGain', v_influence_gain, 'explorationGain', v_exploration_gain));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_influence_gain,
    'explorationGain', v_exploration_gain,
    'newInfluenceStock', v_new_influence_stock,
    'newExploration', v_new_exploration,
    'newGlory', v_new_exploration + (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202_v05_rpc_visit_place.sql .archives/migrations/202_v05_rpc_visit_place.sql
git commit -m "feat: add visit_place_gps RPC (V0.5 explorer system)"
```

---

### Task 9 : RPC answer_daily_enigma

**Files:**
- Create: `supabase/migrations/203_v05_rpc_daily_enigma.sql`
- Archive: `.archives/migrations/203_v05_rpc_daily_enigma.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 203_v05_rpc_daily_enigma.sql
-- V0.5 : Répondre à l'énigme quotidienne

-- D'abord : fonction pour obtenir l'énigme du jour
CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_answered BOOLEAN;
  v_enigma RECORD;
BEGIN
  -- Déjà répondu aujourd'hui ?
  SELECT EXISTS(
    SELECT 1 FROM enigma_responses er
    JOIN enigmas e ON e.id = er.enigma_id
    WHERE er.user_id = p_user_id
      AND e.type = 'daily'
      AND er.responded_at::DATE = CURRENT_DATE
  ) INTO v_already_answered;

  IF v_already_answered THEN
    RETURN json_build_object('already_answered', true);
  END IF;

  -- Sélectionner une énigme que le joueur n'a jamais vue
  SELECT e.* INTO v_enigma
  FROM enigmas e
  WHERE e.type = 'daily'
    AND e.active = TRUE
    AND e.id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id)
  ORDER BY RANDOM()
  LIMIT 1;

  IF v_enigma.id IS NULL THEN
    -- Fallback : n'importe quelle énigme active (toutes vues)
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily' AND e.active = TRUE
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'no_enigma_available');
  END IF;

  RETURN json_build_object(
    'id', v_enigma.id,
    'difficulty', v_enigma.difficulty,
    'loreText', v_enigma.lore_text,
    'question', v_enigma.question,
    'format', v_enigma.format,
    'choices', v_enigma.choices,
    'heritageId', v_enigma.heritage_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(TEXT) TO authenticated;

-- Répondre à l'énigme
CREATE OR REPLACE FUNCTION public.answer_enigma(
  p_user_id TEXT,
  p_enigma_id INT,
  p_answer TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  -- Vérifier la réponse (case-insensitive, trim)
  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));

  -- Calculer les gains selon difficulté
  IF v_enigma.type = 'daily' THEN
    v_diff_key := v_enigma.difficulty;

    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    ELSE
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_enigma_wrong'), 1) INTO v_erudition_gain;
    END IF;

  ELSIF v_enigma.type = 'place' THEN
    IF v_correct THEN
      v_influence_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
      v_erudition_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
    ELSE
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_enigma_wrong'), 1) INTO v_erudition_gain;
    END IF;
  END IF;

  -- Enregistrer la réponse
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  -- Donner les récompenses
  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  RETURN json_build_object(
    'correct', v_correct,
    'answer', v_enigma.answer,
    'explanation', v_enigma.explanation,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id),
    'newGlory', (SELECT exploration_points + erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_enigma(TEXT, INT, TEXT) TO authenticated;
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/203_v05_rpc_daily_enigma.sql .archives/migrations/203_v05_rpc_daily_enigma.sql
git commit -m "feat: add get_daily_enigma and answer_enigma RPCs (V0.5)"
```

---

### Task 10 : RPC contribute_to_place (pages de carnet, photos, infos)

**Files:**
- Create: `supabase/migrations/204_v05_rpc_contributions.sql`
- Archive: `.archives/migrations/204_v05_rpc_contributions.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 204_v05_rpc_contributions.sql
-- V0.5 : Ajouter une contribution sur un lieu + voter

CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_type TEXT,          -- 'carnet', 'photo', 'accessibility', 'season', 'warning'
  p_content TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_influence_gain INT := 0;
  v_exploration_gain INT := 0;
  v_erudition_gain INT := 0;
  v_contribution_id INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Insérer la contribution (UNIQUE constraint = 1 par type par user)
  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content = COALESCE(EXCLUDED.content, place_contributions.content),
               image_url = COALESCE(EXCLUDED.image_url, place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  -- Gains selon le type
  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_photo'), 5) INTO v_influence_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 1) INTO v_exploration_gain;
  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_carnet'), 10) INTO v_influence_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 1) INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 1) INTO v_erudition_gain;
  END IF;

  -- Créditer le joueur
  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + v_exploration_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Ajouter de l'influence de contenu sur le lieu
  IF v_influence_gain > 0 THEN
    INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
    VALUES (p_place_id, v_faction_id, v_influence_gain, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = place_influence.content_points + v_influence_gain,
                 updated_at = NOW();
  END IF;

  RETURN json_build_object(
    'success', true,
    'contributionId', v_contribution_id,
    'influenceGain', v_influence_gain,
    'explorationGain', v_exploration_gain,
    'eruditionGain', v_erudition_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Voter sur une contribution
CREATE OR REPLACE FUNCTION public.vote_contribution(
  p_user_id TEXT,
  p_contribution_id INT,
  p_vote INT           -- 1 = up, -1 = down
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contrib RECORD;
  v_old_vote INT;
BEGIN
  SELECT * INTO v_contrib FROM place_contributions WHERE id = p_contribution_id;
  IF v_contrib.id IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  -- Pas de vote sur son propre contenu
  IF v_contrib.user_id = p_user_id THEN
    RETURN json_build_object('error', 'cannot_vote_own');
  END IF;

  -- Vérifier vote existant
  SELECT vote INTO v_old_vote FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  IF v_old_vote IS NOT NULL THEN
    IF v_old_vote = p_vote THEN
      RETURN json_build_object('error', 'already_voted');
    END IF;
    -- Changer de vote
    UPDATE contribution_votes SET vote = p_vote WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1, votes_down = votes_down - 1 WHERE id = p_contribution_id;
    ELSE
      UPDATE place_contributions SET votes_up = votes_up - 1, votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  ELSE
    -- Nouveau vote
    INSERT INTO contribution_votes (contribution_id, user_id, vote) VALUES (p_contribution_id, p_user_id, p_vote);
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
      -- +1 influence permanente pour l'auteur sur le lieu
      INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
      VALUES (v_contrib.place_id, v_contrib.faction_id, 1, NOW())
      ON CONFLICT (place_id, faction_id)
      DO UPDATE SET content_points = place_influence.content_points + 1, updated_at = NOW();
    ELSE
      UPDATE place_contributions SET votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'newVotesUp', (SELECT votes_up FROM place_contributions WHERE id = p_contribution_id),
    'newVotesDown', (SELECT votes_down FROM place_contributions WHERE id = p_contribution_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_contribution(TEXT, INT, INT) TO authenticated;
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/204_v05_rpc_contributions.sql .archives/migrations/204_v05_rpc_contributions.sql
git commit -m "feat: add contribute_to_place and vote_contribution RPCs (V0.5)"
```

---

### Task 11 : RPC get_place_detail (nouvelle fiche de lieu complète)

**Files:**
- Create: `supabase/migrations/205_v05_rpc_place_detail.sql`
- Archive: `.archives/migrations/205_v05_rpc_place_detail.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 205_v05_rpc_place_detail.sql
-- V0.5 : Fiche de lieu complète (influence, contributions, explorateurs, note)

CREATE OR REPLACE FUNCTION public.get_place_detail_v05(
  p_place_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_influence JSON;
  v_contributions JSON;
  v_explorers JSON;
  v_avg_rating NUMERIC;
  v_rating_count INT;
  v_user_rating INT;
  v_is_wishlisted BOOLEAN := FALSE;
  v_is_explorer BOOLEAN := FALSE;
  v_dominant_faction TEXT;
  v_dominant_score INT := 0;
  v_guardian RECORD;
BEGIN
  -- Influence par héritage (drapeaux en ligne)
  SELECT json_agg(
    json_build_object(
      'factionId', pi.faction_id,
      'placed', pi.placed_points,
      'content', pi.content_points,
      'total', pi.placed_points + pi.content_points
    ) ORDER BY (pi.placed_points + pi.content_points) DESC
  ) INTO v_influence
  FROM place_influence pi WHERE pi.place_id = p_place_id;

  -- Faction dominante
  SELECT faction_id, (placed_points + content_points)
  INTO v_dominant_faction, v_dominant_score
  FROM place_influence
  WHERE place_id = p_place_id
  ORDER BY (placed_points + content_points) DESC
  LIMIT 1;

  -- Contributions (triées par votes)
  SELECT json_agg(
    json_build_object(
      'id', pc.id,
      'userId', pc.user_id,
      'factionId', pc.faction_id,
      'type', pc.type,
      'content', pc.content,
      'imageUrl', pc.image_url,
      'votesUp', pc.votes_up,
      'votesDown', pc.votes_down,
      'createdAt', pc.created_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url
    ) ORDER BY pc.votes_up DESC, pc.created_at ASC
  ) INTO v_contributions
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id;

  -- Explorateurs (Hall of Fame)
  SELECT json_agg(
    json_build_object(
      'userId', pe.user_id,
      'visitedAt', pe.visited_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url,
      'factionId', u.faction_id
    ) ORDER BY pe.visited_at ASC
  ) INTO v_explorers
  FROM place_explorers pe
  JOIN users u ON u.id = pe.user_id
  WHERE pe.place_id = p_place_id;

  -- Note moyenne
  SELECT AVG(rating)::NUMERIC(2,1), COUNT(*) INTO v_avg_rating, v_rating_count
  FROM place_ratings WHERE place_id = p_place_id;

  -- Gardien (top contributeur contenu)
  SELECT pc.user_id, u.first_name AS name, u.avatar_url, u.faction_id,
    SUM(pc.votes_up) AS total_votes
  INTO v_guardian
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id
  GROUP BY pc.user_id, u.first_name, u.avatar_url, u.faction_id
  ORDER BY total_votes DESC
  LIMIT 1;

  -- Infos spécifiques au joueur connecté
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_wishlisted;

    SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_explorer;

    SELECT rating INTO v_user_rating FROM place_ratings WHERE place_id = p_place_id AND user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'influence', COALESCE(v_influence, '[]'::json),
    'dominantFaction', v_dominant_faction,
    'contributions', COALESCE(v_contributions, '[]'::json),
    'explorers', COALESCE(v_explorers, '[]'::json),
    'avgRating', v_avg_rating,
    'ratingCount', v_rating_count,
    'userRating', v_user_rating,
    'isWishlisted', v_is_wishlisted,
    'isExplorer', v_is_explorer,
    'guardian', CASE WHEN v_guardian.user_id IS NOT NULL THEN
      json_build_object('userId', v_guardian.user_id, 'name', v_guardian.name,
        'avatar', v_guardian.avatar_url, 'factionId', v_guardian.faction_id)
    ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO anon;
```

- [ ] **Step 2: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/205_v05_rpc_place_detail.sql .archives/migrations/205_v05_rpc_place_detail.sql
git commit -m "feat: add get_place_detail_v05 RPC (collaborative place pages)"
```

---

### Task 12 : RPC decay_influence + RPC rate_place + RPC toggle_wishlist

**Files:**
- Create: `supabase/migrations/206_v05_rpc_decay_rating_wishlist.sql`
- Archive: `.archives/migrations/206_v05_rpc_decay_rating_wishlist.sql`

- [ ] **Step 1: Écrire les RPCs**

```sql
-- 206_v05_rpc_decay_rating_wishlist.sql
-- V0.5 : Decay hebdomadaire + noter un lieu + wishlist

-- Decay : à appeler via un cron Supabase (pg_cron) ou manuellement chaque semaine
CREATE OR REPLACE FUNCTION public.decay_placed_influence()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decay INT;
  v_affected INT;
BEGIN
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_decay_per_week'), 1) INTO v_decay;

  UPDATE place_influence
  SET placed_points = GREATEST(0, placed_points - v_decay),
      updated_at = NOW()
  WHERE placed_points > 0;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  -- Nettoyer les lignes mortes (0 placé + 0 contenu)
  DELETE FROM place_influence WHERE placed_points = 0 AND content_points = 0;

  RETURN json_build_object('decayed', v_affected, 'decayAmount', v_decay);
END;
$$;

-- Rate a place (explorateurs uniquement)
CREATE OR REPLACE FUNCTION public.rate_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_rating INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_explorer BOOLEAN;
  v_is_author BOOLEAN;
BEGIN
  -- Vérifier que le joueur est explorateur OU auteur du lieu
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_is_explorer;

  SELECT EXISTS(SELECT 1 FROM places WHERE id = p_place_id AND author_id = p_user_id)
  INTO v_is_author;

  IF NOT v_is_explorer AND NOT v_is_author THEN
    RETURN json_build_object('error', 'must_be_explorer');
  END IF;

  INSERT INTO place_ratings (place_id, user_id, rating)
  VALUES (p_place_id, p_user_id, p_rating)
  ON CONFLICT (place_id, user_id)
  DO UPDATE SET rating = p_rating, updated_at = NOW();

  RETURN json_build_object('success', true,
    'avgRating', (SELECT AVG(rating)::NUMERIC(2,1) FROM place_ratings WHERE place_id = p_place_id),
    'count', (SELECT COUNT(*) FROM place_ratings WHERE place_id = p_place_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_place(TEXT, TEXT, INT) TO authenticated;

-- Toggle wishlist
CREATE OR REPLACE FUNCTION public.toggle_wishlist(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_exists;

  IF v_exists THEN
    DELETE FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id;
    RETURN json_build_object('wishlisted', false);
  ELSE
    INSERT INTO place_wishlist (place_id, user_id) VALUES (p_place_id, p_user_id);
    RETURN json_build_object('wishlisted', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_wishlist(TEXT, TEXT) TO authenticated;
```

- [ ] **Step 2: Copier dans .archives, appliquer**

- [ ] **Step 3: Configurer pg_cron pour le decay** (via Supabase Dashboard > Extensions)

```sql
-- Activer pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Decay tous les lundis à 3h du matin
SELECT cron.schedule('decay-influence', '0 3 * * 1', 'SELECT decay_placed_influence()');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/206_v05_rpc_decay_rating_wishlist.sql .archives/migrations/206_v05_rpc_decay_rating_wishlist.sql
git commit -m "feat: add decay_placed_influence, rate_place, toggle_wishlist RPCs (V0.5)"
```

---

### Task 13 : Mettre à jour discover_place pour V0.5

**Files:**
- Create: `supabase/migrations/207_v05_update_discover_place.sql`
- Archive: `.archives/migrations/207_v05_update_discover_place.sql`

- [ ] **Step 1: Lire la version actuelle de discover_place**

Lire `.archives/migrations/` les fichiers qui définissent `discover_place` pour avoir la version la plus récente. **Ne jamais improviser une RPC — toujours lire l'ancienne version.**

- [ ] **Step 2: Modifier discover_place pour ajouter exploration_points + influence_stock**

Ajouter à la fin de la RPC existante (après le gain de gloire existant) :

```sql
-- V0.5 : ajouter exploration + influence
UPDATE users SET
  exploration_points = exploration_points + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_place'), 5),
  influence_stock = influence_stock + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_place'), 25)
WHERE id = p_user_id;

-- Enregistrer comme explorateur automatiquement (le créateur est le premier explorateur)
INSERT INTO place_explorers (place_id, user_id)
VALUES (p_place_id, p_user_id)
ON CONFLICT DO NOTHING;

-- Ajouter de l'influence de contenu initiale pour la faction du découvreur
INSERT INTO place_influence (place_id, faction_id, content_points)
VALUES (p_place_id, v_faction_id, COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_place'), 5))
ON CONFLICT (place_id, faction_id)
DO UPDATE SET content_points = place_influence.content_points + EXCLUDED.content_points;
```

Ajouter dans le JSON de retour : `'explorationGain'`, `'influenceGain'`, `'newInfluenceStock'`.

- [ ] **Step 3: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/207_v05_update_discover_place.sql .archives/migrations/207_v05_update_discover_place.sql
git commit -m "feat: update discover_place to give exploration + influence (V0.5)"
```

---

### Task 14 : Mettre à jour get_my_informations + get_player_profile pour V0.5

**Files:**
- Create: `supabase/migrations/208_v05_update_profile_rpcs.sql`
- Archive: `.archives/migrations/208_v05_update_profile_rpcs.sql`

- [ ] **Step 1: Lire les versions actuelles** de `get_my_informations` et `get_player_profile` (dans les migrations récentes)

- [ ] **Step 2: Ajouter les nouveaux champs au JSON retourné**

Dans les deux RPCs, ajouter au JSON de retour :
```sql
'explorationPoints', u.exploration_points,
'eruditionPoints', u.erudition_points,
'influenceStock', u.influence_stock,
'glory', u.exploration_points + u.erudition_points
```

Garder `notorietyPoints` aussi pour la rétrocompatibilité temporaire.

- [ ] **Step 3: Copier dans .archives, appliquer, vérifier**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/208_v05_update_profile_rpcs.sql .archives/migrations/208_v05_update_profile_rpcs.sql
git commit -m "feat: update profile RPCs with exploration, erudition, influence (V0.5)"
```

---

## Phase 3 : Frontend — Système d'influence + profil

> Remplacer claim/fortify par le placement d'influence. Mettre à jour le profil et le leaderboard.

---

### Task 15 : Mettre à jour playerStore avec les nouvelles ressources

**Files:**
- Modify: `apps/explore-web/src/stores/playerStore.ts`

- [ ] **Step 1: Ajouter les nouveaux champs au store**

```typescript
// Nouveaux champs V0.5
explorationPoints: number;
eruditionPoints: number;
influenceStock: number;
glory: number;  // = explorationPoints + eruditionPoints
```

- [ ] **Step 2: Mettre à jour le parsing des RPCs** (get_my_informations, get_user_energy) pour lire les nouveaux champs

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/stores/playerStore.ts
git commit -m "feat: add exploration, erudition, influence to playerStore (V0.5)"
```

---

### Task 16 : Créer InfluenceButton (remplace ClaimButton + FortifyButton)

**Files:**
- Create: `apps/explore-web/src/components/places/InfluenceButton.tsx`
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx`

- [ ] **Step 1: Créer InfluenceButton**

Composant qui :
- Affiche le stock d'influence du joueur
- Permet de choisir combien de points placer (slider ou boutons +/-)
- Appelle `place_influence_action` RPC
- Si GPS actif : pas de limite, afficher "Sur place — illimité"
- Si à distance : afficher "À distance — max 5/jour" avec le restant

- [ ] **Step 2: Mettre à jour PlacePanel** pour remplacer `<ClaimButton>` et `<FortifyButton>` par `<InfluenceButton>`

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/InfluenceButton.tsx apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: replace ClaimButton + FortifyButton with InfluenceButton (V0.5)"
```

---

### Task 17 : Afficher les drapeaux d'influence sur la fiche de lieu

**Files:**
- Create: `apps/explore-web/src/components/places/InfluenceFlags.tsx`
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx`

- [ ] **Step 1: Créer InfluenceFlags**

```
🟢 142  🔵 89  🟣 203 ⭐  🔴 45
```

Composant horizontal : pour chaque faction ayant de l'influence, afficher drapeau + score. Étoile sur le dominant.

- [ ] **Step 2: Intégrer dans PlacePanel** sous le titre du lieu

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/InfluenceFlags.tsx apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: add InfluenceFlags to place detail (V0.5)"
```

---

### Task 18 : Mettre à jour territoryWorker pour utiliser l'influence

**Files:**
- Modify: `apps/explore-web/src/workers/territoryWorker.ts`
- Modify: `apps/explore-web/src/lib/map-layers.ts`

- [ ] **Step 1: Modifier le scoring dans territoryWorker**

Remplacer la formule actuelle (likes × 1 + views × 0.1 + explored × 2 + fortificationBonus) par :

```typescript
// V0.5 : le score du lieu = influence totale (toutes factions)
// La faction dominante = celle avec le plus d'influence
// Le rayon = basé sur l'influence totale
function getPlaceScore(place: PlaceInput): number {
  return place.totalInfluence ?? 0; // somme de toutes les factions
}

function getDominantFaction(place: PlaceInput): string | null {
  // Retourne la faction avec le plus d'influence
  if (!place.influenceByFaction) return place.factionId; // fallback V0.4
  let max = 0;
  let dominant = null;
  for (const [factionId, score] of Object.entries(place.influenceByFaction)) {
    if (score > max) { max = score; dominant = factionId; }
  }
  return dominant;
}
```

- [ ] **Step 2: Supprimer la fonction `fortificationBonus()`** (plus utilisée)

- [ ] **Step 3: Mettre à jour map-layers.ts** — la couleur du territoire est basée sur la faction dominante du lieu, qui vient maintenant de `place_influence`

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/workers/territoryWorker.ts apps/explore-web/src/lib/map-layers.ts
git commit -m "feat: territory scoring based on influence instead of fortification (V0.5)"
```

---

### Task 19 : Mettre à jour le profil joueur (Gloire = Exploration + Érudition)

**Files:**
- Modify: `apps/explore-web/src/components/map/PlayerProfileModal.tsx`
- Modify: `apps/explore-web/src/components/map/LeaderboardModal.tsx`
- Modify: `apps/explore-web/src/components/map/EnergyIndicator.tsx`

- [ ] **Step 1: Profil** — Afficher :
- 🎖️ Gloire (gros chiffre) = Exploration + Érudition
- 🧭 Exploration : X points (sous-score)
- 📖 Érudition : X points (sous-score)
- 🏰 Stock d'influence : X points (dépensable)

- [ ] **Step 2: Leaderboard** — Trier par Gloire (exploration + erudition) au lieu de notorietyPoints

- [ ] **Step 3: EnergyIndicator** — Ajouter un petit indicateur du stock d'influence à côté de la barre d'énergie

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/map/PlayerProfileModal.tsx apps/explore-web/src/components/map/LeaderboardModal.tsx apps/explore-web/src/components/map/EnergyIndicator.tsx
git commit -m "feat: profile shows Glory=Exploration+Erudition, influence stock (V0.5)"
```

---

## Phase 4 : Frontend — Fiches collaboratives + Énigme quotidienne

---

### Task 20 : Composant PlaceContributions (pages de carnet + photos + infos)

**Files:**
- Create: `apps/explore-web/src/components/places/PlaceContributions.tsx`
- Create: `apps/explore-web/src/components/places/ContributionCard.tsx`
- Create: `apps/explore-web/src/components/places/AddContributionModal.tsx`
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx`

- [ ] **Step 1: ContributionCard** — Affiche une contribution (nom, avatar, faction, texte/photo, votes up/down, date). Boutons vote.

- [ ] **Step 2: PlaceContributions** — Liste les contributions triées par votes_up DESC. Tabs par type (Carnets | Photos | Infos). Bouton "Ajouter ma page de carnet".

- [ ] **Step 3: AddContributionModal** — Formulaire : type (carnet/photo/accessibilité/saison/warning), champ texte ou upload photo.

- [ ] **Step 4: Intégrer dans PlacePanel** après les InfluenceFlags.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/places/PlaceContributions.tsx apps/explore-web/src/components/places/ContributionCard.tsx apps/explore-web/src/components/places/AddContributionModal.tsx apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: collaborative place contributions (carnet, photos, info) (V0.5)"
```

---

### Task 21 : Composants PlaceExplorers + PlaceRating + WishlistButton

**Files:**
- Create: `apps/explore-web/src/components/places/PlaceExplorers.tsx`
- Create: `apps/explore-web/src/components/places/PlaceRating.tsx`
- Create: `apps/explore-web/src/components/places/WishlistButton.tsx`
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx`

- [ ] **Step 1: PlaceExplorers** — Hall of Fame : row d'avatars des explorateurs GPS. Si le joueur est sur place (GPS) et pas encore dans la liste → bouton "J'y suis allé" qui appelle `visit_place_gps`.

- [ ] **Step 2: PlaceRating** — Étoiles (1-5). Actif uniquement si le joueur est dans les explorateurs OU auteur. Affiche la moyenne.

- [ ] **Step 3: WishlistButton** — Toggle "Je veux y aller" (cœur/bookmark). Appelle `toggle_wishlist`.

- [ ] **Step 4: Intégrer dans PlacePanel** — Rating dans l'en-tête, Explorers sous les contributions, Wishlist dans l'en-tête.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/places/PlaceExplorers.tsx apps/explore-web/src/components/places/PlaceRating.tsx apps/explore-web/src/components/places/WishlistButton.tsx apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: add PlaceExplorers, PlaceRating, WishlistButton (V0.5)"
```

---

### Task 22 : Composant DailyEnigma

**Files:**
- Create: `apps/explore-web/src/components/enigma/DailyEnigma.tsx`
- Create: `apps/explore-web/src/components/enigma/EnigmaResult.tsx`
- Modify: `apps/explore-web/src/components/map/MapView.tsx` (ou équivalent — ajouter l'icône coffre)

- [ ] **Step 1: DailyEnigma** — Modal/sheet :
1. Appelle `get_daily_enigma` au montage
2. Si `already_answered` → affiche "Reviens demain !"
3. Sinon → affiche lore_text, question, choices (QCM) ou champ libre
4. Au submit → appelle `answer_enigma`
5. Affiche EnigmaResult

- [ ] **Step 2: EnigmaResult** — Affiche :
- Correct/incorrect avec animation
- L'explication (toujours)
- Les gains (Influence + Érudition)

- [ ] **Step 3: Ajouter l'icône coffre** sur la carte (coin de l'écran). Pulse si non répondu aujourd'hui. Ouvre DailyEnigma au clic.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/enigma/DailyEnigma.tsx apps/explore-web/src/components/enigma/EnigmaResult.tsx apps/explore-web/src/components/map/MapView.tsx
git commit -m "feat: add DailyEnigma with chest icon on map (V0.5)"
```

---

### Task 23 : Composant PlaceEnigma (énigme sur place)

**Files:**
- Create: `apps/explore-web/src/components/enigma/PlaceEnigma.tsx`
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx`

- [ ] **Step 1: PlaceEnigma** — Similaire à DailyEnigma mais :
- N'apparaît que si le joueur est sur place (GPS)
- Charge une énigme de type 'place' liée aux tags du lieu
- Récompenses différentes (base + /difficulté)

- [ ] **Step 2: Intégrer dans PlacePanel** — Afficher sous le bouton "J'y suis allé" si le joueur est sur place et qu'une énigme de lieu est disponible.

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/enigma/PlaceEnigma.tsx apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: add PlaceEnigma for GPS visitors (V0.5)"
```

---

## Phase 5 : Hub — Gestion admin

---

### Task 24 : Page de gestion des énigmes dans le Hub

**Files:**
- Create: `apps/hub/src/components/Enigmas.tsx`
- Modify: `apps/hub/src/App.tsx` (ajouter la route)
- Modify: `apps/hub/src/components/Sidebar.tsx` (ajouter le lien)

- [ ] **Step 1: Enigmas.tsx** — Page complète de gestion :
- Liste paginée de toutes les énigmes (filtrable par type, difficulté, héritage, actif/inactif)
- Formulaire de création/édition : type, difficulté, heritage_id, place_tag, lore_text, question, format (qcm/free), choices, answer, explanation
- Toggle actif/inactif
- Stats : nombre de réponses, % de bonnes réponses
- Pattern SaveBar comme les autres pages du Hub

- [ ] **Step 2: Ajouter la route** dans App.tsx et le lien dans Sidebar.tsx

- [ ] **Step 3: Commit**

```bash
git add apps/hub/src/components/Enigmas.tsx apps/hub/src/App.tsx apps/hub/src/components/Sidebar.tsx
git commit -m "feat: add Enigmas management page to Hub (V0.5)"
```

---

### Task 25 : Mettre à jour Settings.tsx pour V0.5

**Files:**
- Modify: `apps/hub/src/components/Settings.tsx`

- [ ] **Step 1: Ajouter une section "V0.5 — Influence & Énigmes"** dans la page Settings :

Afficher et permettre de modifier tous les `app_settings` V0.5 :
- `influence_max_remote_per_day`
- `influence_decay_per_week`
- `influence_visit_gps`, `influence_add_place`, `influence_add_photo`, `influence_add_carnet`, `influence_per_vote`
- `exploration_*`, `erudition_*`, `enigma_*`

Grouper par catégorie (Influence, Exploration, Érudition, Énigmes).

- [ ] **Step 2: Commit**

```bash
git add apps/hub/src/components/Settings.tsx
git commit -m "feat: add V0.5 influence/enigma settings to Hub (V0.5)"
```

---

### Task 26 : Mettre à jour Users.tsx et Dashboard.tsx

**Files:**
- Modify: `apps/hub/src/components/Users.tsx`
- Modify: `apps/hub/src/components/UserDetail.tsx` (si existe)
- Modify: `apps/hub/src/components/Dashboard.tsx`

- [ ] **Step 1: Users** — Afficher les nouvelles colonnes : exploration_points, erudition_points, influence_stock, glory (calculé). Remplacer "Notoriété" par "Gloire".

- [ ] **Step 2: Dashboard** — Ajouter des stats V0.5 :
- Nombre d'énigmes répondues aujourd'hui
- Influence totale placée cette semaine
- Top contributeurs (par contenu)
- Lieux les plus documentés

- [ ] **Step 3: Commit**

```bash
git add apps/hub/src/components/Users.tsx apps/hub/src/components/Dashboard.tsx
git commit -m "feat: update Users and Dashboard for V0.5 metrics"
```

---

### Task 27 : Mettre à jour ou désactiver Constructions.tsx

**Files:**
- Modify: `apps/hub/src/components/Constructions.tsx`

- [ ] **Step 1: Soit supprimer la page** (si plus aucune utilité), soit la convertir en page de visualisation de l'influence par lieu. À décider avec Uriel.

- [ ] **Step 2: Si suppression** — retirer la route dans App.tsx et le lien dans Sidebar.tsx

- [ ] **Step 3: Commit**

```bash
git add apps/hub/src/components/Constructions.tsx apps/hub/src/App.tsx apps/hub/src/components/Sidebar.tsx
git commit -m "chore: remove Constructions page (fortification system replaced by influence)"
```

---

## Phase 6 : Migration données + Cleanup

> **ATTENTION : Cette phase touche aux données live. Faire un backup Supabase avant.**

---

### Task 28 : Migrer les données existantes vers le système d'influence

**Files:**
- Create: `supabase/migrations/209_v05_data_migration.sql`
- Archive: `.archives/migrations/209_v05_data_migration.sql`

- [ ] **Step 1: Backup** — Depuis le dashboard Supabase, créer un backup complet de la DB.

- [ ] **Step 2: Écrire la migration de données**

```sql
-- 209_v05_data_migration.sql
-- V0.5 : Migrer les claims/fortifications existants en influence

-- 1. Convertir les claims existants en influence de contenu
-- Chaque lieu claimé donne 10 points de contenu à la faction qui le possédait
INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
SELECT p.id, p.faction_id, 10 + COALESCE(p.fortification_level, 0) * 5, NOW()
FROM places p
WHERE p.faction_id IS NOT NULL
ON CONFLICT (place_id, faction_id) DO NOTHING;

-- 2. Convertir notoriety_points existants en exploration_points
-- (la gloire existante venait principalement d'actions terrain)
UPDATE users SET exploration_points = COALESCE(notoriety_points, 0)
WHERE notoriety_points > 0;

-- 3. Donner un stock d'influence de départ à chaque joueur actif
-- (pour qu'ils ne repartent pas de zéro)
UPDATE users SET influence_stock = 20
WHERE faction_id IS NOT NULL AND influence_stock = 0;

-- 4. Enregistrer les auteurs de lieux comme explorateurs
INSERT INTO place_explorers (place_id, user_id, visited_at)
SELECT p.id, p.author_id, p.created_at
FROM places p
WHERE p.author_id IS NOT NULL
ON CONFLICT (place_id, user_id) DO NOTHING;
```

- [ ] **Step 3: Appliquer via SQL Editor** (pas via push automatique — vérifier chaque requête)

- [ ] **Step 4: Vérifier**

```sql
-- Influence migrée ?
SELECT COUNT(*) FROM place_influence;

-- Exploration migrée ?
SELECT id, notoriety_points, exploration_points, influence_stock FROM users WHERE faction_id IS NOT NULL LIMIT 10;

-- Explorateurs migrés ?
SELECT COUNT(*) FROM place_explorers;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/209_v05_data_migration.sql .archives/migrations/209_v05_data_migration.sql
git commit -m "feat: migrate existing claims/notoriety to influence/exploration (V0.5)"
```

---

### Task 29 : Cleanup — Supprimer l'ancien système

**Files:**
- Create: `supabase/migrations/210_v05_cleanup.sql`
- Archive: `.archives/migrations/210_v05_cleanup.sql`
- Delete: `apps/explore-web/src/components/places/ClaimButton.tsx`
- Delete: `apps/explore-web/src/components/places/FortifyButton.tsx`

- [ ] **Step 1: Écrire la migration de cleanup**

```sql
-- 210_v05_cleanup.sql
-- V0.5 : Nettoyage de l'ancien système claim/fortify
-- ⚠️ IRREVERSIBLE — ne lancer qu'après avoir vérifié que tout fonctionne

-- Supprimer les RPCs obsolètes
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC);
DROP FUNCTION IF EXISTS public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC);

-- Supprimer les anciens app_settings
DELETE FROM app_settings WHERE key IN (
  'zone_fort_multiplier', 'territory_size_defense_mult',
  'glory_claim', 'glory_fortify', 'glory_cost_bonus_pct'
);

-- Garder preview_action_cost pour discover (simplifier pour enlever claim/fortify)
-- → À réécrire pour ne garder que le mode 'discover'

-- NOTE : On ne supprime PAS les colonnes places.faction_id, claimed_by, etc.
-- car elles servent encore de fallback pendant la transition.
-- On les supprimera dans un cycle futur quand tout sera stabilisé.
```

- [ ] **Step 2: Supprimer ClaimButton.tsx et FortifyButton.tsx** du frontend

- [ ] **Step 3: Retirer toute référence** à ClaimButton et FortifyButton dans les imports

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove claim/fortify system, keep columns for fallback (V0.5 cleanup)"
```

---

### Task 30 : Mettre à jour les CLAUDE.md

**Files:**
- Modify: `apps/explore-web/CLAUDE.md`
- Modify: `apps/hub/CLAUDE.md`
- Modify: `CLAUDE.md` (racine)

- [ ] **Step 1: explore-web/CLAUDE.md** — Renommer en "V0.5 — De la Conquête à l'Influence". Documenter les nouveaux composants, stores, RPCs.

- [ ] **Step 2: hub/CLAUDE.md** — Ajouter la page Enigmas, les nouveaux settings.

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/CLAUDE.md apps/hub/CLAUDE.md CLAUDE.md
git commit -m "docs: update CLAUDE.md files for V0.5"
```

---

### Task 31 : Mettre à jour les fichiers .wolf/

**Files:**
- Modify: `apps/explore-web/.wolf/schema.md`
- Modify: `apps/explore-web/.wolf/rpcs.md`
- Modify: `apps/explore-web/.wolf/gameplay.md`
- Modify: `apps/explore-web/.wolf/stores.md`
- Modify: `apps/explore-web/.wolf/anatomy.md`
- Modify: `apps/hub/.wolf/schema.md`
- Modify: `apps/hub/.wolf/anatomy.md`

- [ ] **Step 1: Mettre à jour chaque fichier** pour refléter les nouvelles tables, RPCs, composants, et stores.

- [ ] **Step 2: Commit**

```bash
git add apps/explore-web/.wolf/ apps/hub/.wolf/
git commit -m "docs: update .wolf/ reference files for V0.5"
```

---

## Checklist de déploiement

- [ ] **Backup DB** avant Phase 6
- [ ] **Phase 1** : Appliquer migrations 195-200 (additif pur)
- [ ] **Phase 2** : Appliquer migrations 201-208 (nouvelles RPCs)
- [ ] **Tester** les RPCs manuellement via SQL Editor
- [ ] **Phase 3** : Déployer le nouveau frontend (influence + profil)
- [ ] **Phase 4** : Déployer fiches collaboratives + énigme
- [ ] **Phase 5** : Déployer le Hub mis à jour
- [ ] **Générer les premières énigmes** (batch de 100 avec Claude)
- [ ] **Phase 6** : Migration données + cleanup
- [ ] **Mettre à jour la Bible Game Design** pour marquer V0.5 comme déployée
- [ ] **Tester E2E** : créer un lieu, visiter GPS, placer influence, répondre à une énigme, voter

---

## Risques identifiés

| Risque | Mitigation |
|--------|-----------|
| DB live, données perdues | Backup avant Phase 6, migrations additives d'abord |
| Joueurs perdus par le changement | Communication in-app, loading screen expliquant les nouveautés |
| Énigmes épuisées | Générer 200+ d'un coup, surveiller le stock via Hub |
| Decay trop agressif | Paramètre configurable via app_settings, ajustable sans redéployer |
| Preview_action_cost cassé | Garder l'ancienne RPC fonctionnelle jusqu'au cleanup final |
| Territoires vides après migration | Les données migrées (Task 28) donnent de l'influence de base |
