# Campements — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les joueurs posent un campement personnel sur la carte. Il rayonne sur les lieux proches, les fragments y sont exposes et offrent des bonus perennes. Le campement peut tomber si les adversaires retournent l'influence des lieux alentour.

**Architecture:** Nouvelle table `campements` + RPCs (create, visit, dismantle, get). Le campement ajoute des `content_points` perennes sur les lieux de son aura selon les affinites fragments/tags. Le worker de territoire dessine l'aura. Le CampementPanel est une page riche (fragments, lieux, livre d'or).

**Tech Stack:** PostgreSQL (Supabase RPCs), React 18, TypeScript strict, MapLibre GL JS, Zustand, CSS par composant

---

## Schema de donnees

### Nouvelle table: `campements`

| Colonne | Type | Notes |
|---------|------|-------|
| id | SERIAL PK | |
| user_id | VARCHAR(255) FK users(id) | UNIQUE — un seul par joueur |
| name | VARCHAR(100) | Nom personnalise (la seigneurie) |
| latitude | NUMERIC | Position libre sur la carte |
| longitude | NUMERIC | |
| radius_m | INT | Rayon d'aura en metres (calcule) |
| glory_bonus | INT | Gloire gagnee par le campement (nb lieux × 5) |
| status | VARCHAR(20) | 'active', 'ruins' |
| ruins_until | TIMESTAMPTZ | NULL si actif, date de fin ruines sinon |
| created_at | TIMESTAMPTZ | |

### Nouvelle table: `campement_fragments`

| Colonne | Type | Notes |
|---------|------|-------|
| campement_id | INT FK campements(id) | |
| fragment_id | INT FK title_fragments(id) | |
| slot | INT | 1, 2, 3... selon emplacements |
| PK | (campement_id, fragment_id) | |

### Nouvelle table: `campement_messages` (livre d'or)

| Colonne | Type | Notes |
|---------|------|-------|
| id | SERIAL PK | |
| campement_id | INT FK campements(id) | |
| user_id | VARCHAR(255) FK users(id) | |
| message | TEXT | |
| created_at | TIMESTAMPTZ | |

### Nouvelle table: `fragment_tag_affinities`

| Colonne | Type | Notes |
|---------|------|-------|
| fragment_id | INT FK title_fragments(id) | |
| tag_id | VARCHAR(255) FK tags(id) | |
| bonus_points | INT | Pts perennes ajoutes (defaut 10) |
| PK | (fragment_id, tag_id) | |

Configurable depuis le Hub : quel fragment boost quel tag.

---

## Fichiers concernes

### Nouveaux fichiers

| Fichier | Role |
|---------|------|
| `supabase/migrations/040_campements.sql` | Schema + RPCs |
| `src/components/campement/CampementPanel.tsx` | Page campement (fragments, lieux, livre d'or) |
| `src/components/campement/CampementPanel.css` | Styles |
| `src/components/campement/CampementMarker.tsx` | Marqueur sur la carte |
| `src/components/campement/CreateCampementModal.tsx` | Modal de creation |
| `src/hooks/useCampement.ts` | Hook fetch campement |
| `src/stores/campementStore.ts` | Store Zustand |
| `apps/hub/src/components/FragmentAffinities.tsx` | Config affinites dans le Hub |

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/components/map/ExploreMap.tsx` | Afficher marqueurs campement + aura |
| `src/stores/playerStore.ts` | Ajouter campementId |
| `src/App.tsx` | Ajouter CampementPanel + CreateCampementModal |
| `src/hooks/usePlaces.ts` | Inclure campements dans le GeoJSON |
| `src/workers/territoryWorker.ts` | Calculer aura campement (cercle simple) |
| `src/components/map/LeaderboardModal.tsx` | Onglet classement seigneuries |
| `apps/hub/src/components/Settings.tsx` | Config campement (cout, rayon, etc.) |

---

## Phase 1 — Schema + RPCs de base

### Task 1: Migration SQL — tables + RPCs

**Files:**
- Create: `supabase/migrations/040_campements.sql`

- [ ] **Step 1: Ecrire la migration — tables**

```sql
-- 040_campements.sql
-- Systeme de campements personnels

-- Tables
CREATE TABLE IF NOT EXISTS campements (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  name VARCHAR(100) NOT NULL DEFAULT 'Mon Campement',
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  radius_m INT NOT NULL DEFAULT 500,
  glory_bonus INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ruins')),
  ruins_until TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campement_fragments (
  campement_id INT NOT NULL REFERENCES campements(id) ON DELETE CASCADE,
  fragment_id INT NOT NULL REFERENCES title_fragments(id) ON DELETE CASCADE,
  slot INT NOT NULL DEFAULT 1,
  PRIMARY KEY (campement_id, fragment_id)
);

CREATE TABLE IF NOT EXISTS campement_messages (
  id SERIAL PRIMARY KEY,
  campement_id INT NOT NULL REFERENCES campements(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fragment_tag_affinities (
  fragment_id INT NOT NULL REFERENCES title_fragments(id) ON DELETE CASCADE,
  tag_id VARCHAR(255) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  bonus_points INT NOT NULL DEFAULT 10,
  PRIMARY KEY (fragment_id, tag_id)
);

-- RLS
ALTER TABLE campements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campements_select" ON campements FOR SELECT USING (true);
ALTER TABLE campement_fragments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campement_fragments_select" ON campement_fragments FOR SELECT USING (true);
ALTER TABLE campement_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campement_messages_select" ON campement_messages FOR SELECT USING (true);
ALTER TABLE fragment_tag_affinities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fragment_tag_affinities_select" ON fragment_tag_affinities FOR SELECT USING (true);

-- Settings
INSERT INTO app_settings (key, value) VALUES
  ('campement_base_radius_m', '500'),
  ('campement_radius_per_fragment', '100'),
  ('campement_affinity_radius_bonus', '150'),
  ('campement_cost_gps', '30'),
  ('campement_cost_close', '50'),
  ('campement_cost_far', '100'),
  ('campement_close_km', '5'),
  ('campement_glory_per_place', '5'),
  ('campement_ruins_days', '7')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Ecrire la RPC — recalcul aura et bonus perennes**

```sql
-- Recalcule le rayon du campement et les bonus perennes sur les lieux
CREATE OR REPLACE FUNCTION public.recalc_campement(p_campement_id INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_camp RECORD;
  v_base_radius INT;
  v_per_fragment INT;
  v_affinity_bonus INT;
  v_fragment_count INT;
  v_affinity_count INT;
  v_new_radius INT;
  v_places_in_aura INT;
  v_glory_per_place INT;
  v_new_glory INT;
  r RECORD;
BEGIN
  SELECT * INTO v_camp FROM campements WHERE id = p_campement_id;
  IF v_camp.id IS NULL OR v_camp.status = 'ruins' THEN
    RETURN json_build_object('error', 'invalid_campement');
  END IF;

  -- Config
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_base_radius_m'), 500) INTO v_base_radius;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_radius_per_fragment'), 100) INTO v_per_fragment;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_affinity_radius_bonus'), 150) INTO v_affinity_bonus;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_glory_per_place'), 5) INTO v_glory_per_place;

  -- Compter fragments places
  SELECT COUNT(*) INTO v_fragment_count FROM campement_fragments WHERE campement_id = p_campement_id;

  -- Compter affinites qui matchent des lieux proches
  -- Un fragment a une affinite si un lieu du bon tag est dans le rayon max possible
  SELECT COUNT(DISTINCT fta.fragment_id) INTO v_affinity_count
  FROM campement_fragments cf
  JOIN fragment_tag_affinities fta ON fta.fragment_id = cf.fragment_id
  JOIN place_tags pt ON pt.tag_id = fta.tag_id AND pt.is_primary = TRUE
  JOIN places p ON p.id = pt.place_id
  WHERE cf.campement_id = p_campement_id
    AND haversine_km(v_camp.latitude, v_camp.longitude, p.latitude, p.longitude) < 2.0;

  -- Calculer le rayon
  v_new_radius := v_base_radius + (v_fragment_count * v_per_fragment) + (v_affinity_count * v_affinity_bonus);

  -- Mettre a jour le rayon
  UPDATE campements SET radius_m = v_new_radius WHERE id = p_campement_id;

  -- Retirer les anciens bonus perennes de ce campement
  -- On utilise un tag special dans activity_log pour tracker
  DELETE FROM activity_log WHERE type = 'campement_bonus' AND data->>'campementId' = p_campement_id::TEXT;

  -- Recalculer les bonus perennes sur les lieux dans l'aura
  FOR r IN
    SELECT p.id AS place_id, pt.tag_id, fta.bonus_points, u.faction_id
    FROM places p
    JOIN place_tags pt ON pt.place_id = p.id AND pt.is_primary = TRUE
    JOIN fragment_tag_affinities fta ON fta.tag_id = pt.tag_id
    JOIN campement_fragments cf ON cf.fragment_id = fta.fragment_id AND cf.campement_id = p_campement_id
    CROSS JOIN (SELECT faction_id FROM users WHERE id = v_camp.user_id) u
    WHERE haversine_km(v_camp.latitude, v_camp.longitude, p.latitude, p.longitude) < (v_new_radius::NUMERIC / 1000)
      AND u.faction_id IS NOT NULL
  LOOP
    INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
    VALUES (r.place_id, r.faction_id, r.bonus_points, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = place_influence.content_points + r.bonus_points, updated_at = NOW();

    -- Tracker pour pouvoir retirer plus tard
    INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
    VALUES ('campement_bonus', v_camp.user_id, r.place_id, r.faction_id,
      jsonb_build_object('campementId', p_campement_id, 'bonusPoints', r.bonus_points));
  END LOOP;

  -- Compter les lieux dans l'aura
  SELECT COUNT(*) INTO v_places_in_aura
  FROM places p
  WHERE haversine_km(v_camp.latitude, v_camp.longitude, p.latitude, p.longitude) < (v_new_radius::NUMERIC / 1000);

  -- Gloire = nb lieux × glory_per_place
  v_new_glory := v_places_in_aura * v_glory_per_place;

  -- Mettre a jour la gloire
  UPDATE users SET exploration_points = exploration_points - v_camp.glory_bonus + v_new_glory
  WHERE id = v_camp.user_id;
  UPDATE campements SET glory_bonus = v_new_glory WHERE id = p_campement_id;

  RETURN json_build_object(
    'success', true,
    'radius', v_new_radius,
    'placesInAura', v_places_in_aura,
    'gloryBonus', v_new_glory,
    'fragments', v_fragment_count,
    'affinities', v_affinity_count
  );
END;
$$;
```

- [ ] **Step 3: Ecrire la RPC — creer un campement**

```sql
CREATE OR REPLACE FUNCTION public.create_campement(
  p_user_id TEXT,
  p_name VARCHAR(100),
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing INT;
  v_faction_id TEXT;
  v_cost INT;
  v_distance_km NUMERIC;
  v_stock INT;
  v_campement_id INT;
  v_close_km NUMERIC;
  v_cost_gps INT;
  v_cost_close INT;
  v_cost_far INT;
  v_nearby_place BOOLEAN;
BEGIN
  -- Verifier qu'il n'a pas deja un campement
  SELECT id INTO v_existing FROM campements WHERE user_id = p_user_id AND status = 'active';
  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('error', 'already_has_campement');
  END IF;

  SELECT faction_id, influence_stock INTO v_faction_id, v_stock FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Verifier qu'il y a un lieu de sa faction a proximite (< 2km)
  SELECT EXISTS(
    SELECT 1 FROM places p
    JOIN place_influence pi ON pi.place_id = p.id AND pi.faction_id = v_faction_id
    WHERE pi.placed_points + pi.content_points > 0
      AND haversine_km(p_latitude, p_longitude, p.latitude, p.longitude) < 2.0
  ) INTO v_nearby_place;

  IF NOT v_nearby_place THEN
    RETURN json_build_object('error', 'no_faction_place_nearby');
  END IF;

  -- Calculer le cout selon la distance GPS
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'campement_close_km'), 5) INTO v_close_km;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_cost_gps'), 30) INTO v_cost_gps;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_cost_close'), 50) INTO v_cost_close;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_cost_far'), 100) INTO v_cost_far;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, p_latitude, p_longitude);
    IF v_distance_km < 0.2 THEN
      v_cost := v_cost_gps;
    ELSIF v_distance_km < v_close_km THEN
      v_cost := v_cost_close;
    ELSE
      v_cost := v_cost_far;
    END IF;
  ELSE
    v_cost := v_cost_far;
  END IF;

  IF v_stock < v_cost THEN
    RETURN json_build_object('error', 'not_enough_influence', 'cost', v_cost, 'stock', v_stock);
  END IF;

  -- Deduire le cout
  UPDATE users SET influence_stock = influence_stock - v_cost WHERE id = p_user_id;

  -- Creer le campement
  INSERT INTO campements (user_id, name, latitude, longitude)
  VALUES (p_user_id, p_name, p_latitude, p_longitude)
  RETURNING id INTO v_campement_id;

  -- Recalculer (rayon, bonus, gloire)
  PERFORM recalc_campement(v_campement_id);

  RETURN json_build_object(
    'success', true,
    'campementId', v_campement_id,
    'cost', v_cost,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_campement(TEXT, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
```

- [ ] **Step 4: Ecrire la RPC — get_campement (detail)**

```sql
CREATE OR REPLACE FUNCTION public.get_campement(p_campement_id INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', c.id,
    'userId', c.user_id,
    'userName', COALESCE(u.first_name, u.email_address),
    'userAvatar', u.avatar_url,
    'factionId', u.faction_id,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'name', c.name,
    'latitude', c.latitude,
    'longitude', c.longitude,
    'radiusM', c.radius_m,
    'gloryBonus', c.glory_bonus,
    'status', c.status,
    'ruinsUntil', c.ruins_until,
    'createdAt', c.created_at,
    'fragments', (
      SELECT COALESCE(json_agg(json_build_object(
        'fragmentId', tf.id,
        'name', tf.name,
        'icon', tf.icon,
        'iconUrl', tf.icon_url,
        'imageUrl', tf.image_url,
        'slot', cf.slot,
        'affinities', (
          SELECT COALESCE(json_agg(json_build_object(
            'tagId', fta.tag_id,
            'tagTitle', t.title,
            'tagIcon', t.icon,
            'bonusPoints', fta.bonus_points
          )), '[]'::json)
          FROM fragment_tag_affinities fta
          JOIN tags t ON t.id = fta.tag_id
          WHERE fta.fragment_id = tf.id
        )
      )), '[]'::json)
      FROM campement_fragments cf
      JOIN title_fragments tf ON tf.id = cf.fragment_id
      WHERE cf.campement_id = c.id
    ),
    'placesInAura', (
      SELECT COUNT(*) FROM places p
      WHERE haversine_km(c.latitude, c.longitude, p.latitude, p.longitude) < (c.radius_m::NUMERIC / 1000)
    ),
    'messages', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', cm.id,
        'userId', cm.user_id,
        'userName', COALESCE(mu.first_name, mu.email_address),
        'userAvatar', mu.avatar_url,
        'message', cm.message,
        'createdAt', cm.created_at
      ) ORDER BY cm.created_at DESC), '[]'::json)
      FROM campement_messages cm
      JOIN users mu ON mu.id = cm.user_id
      WHERE cm.campement_id = c.id
      LIMIT 50
    )
  ) INTO v_result
  FROM campements c
  JOIN users u ON u.id = c.user_id
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE c.id = p_campement_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campement(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campement(INT) TO anon;
```

- [ ] **Step 5: Ecrire les RPCs — actions**

```sql
-- Placer un fragment dans le campement
CREATE OR REPLACE FUNCTION public.place_fragment_in_campement(
  p_user_id TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_camp RECORD;
  v_max_slots INT;
  v_current_count INT;
  v_next_slot INT;
BEGIN
  SELECT * INTO v_camp FROM campements WHERE user_id = p_user_id AND status = 'active';
  IF v_camp.id IS NULL THEN RETURN json_build_object('error', 'no_campement'); END IF;

  -- Verifier que le joueur possede ce fragment
  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  -- Verifier qu'il n'est pas deja place
  IF EXISTS(SELECT 1 FROM campement_fragments WHERE campement_id = v_camp.id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'already_placed');
  END IF;

  -- Max slots = nombre de fragments possedes (pas de limite artificielle)
  SELECT COUNT(*) INTO v_current_count FROM campement_fragments WHERE campement_id = v_camp.id;
  v_next_slot := v_current_count + 1;

  INSERT INTO campement_fragments (campement_id, fragment_id, slot)
  VALUES (v_camp.id, p_fragment_id, v_next_slot);

  -- Recalculer
  PERFORM recalc_campement(v_camp.id);

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_fragment_in_campement(TEXT, INT) TO authenticated;

-- Retirer un fragment du campement
CREATE OR REPLACE FUNCTION public.remove_fragment_from_campement(
  p_user_id TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_camp RECORD;
BEGIN
  SELECT * INTO v_camp FROM campements WHERE user_id = p_user_id AND status = 'active';
  IF v_camp.id IS NULL THEN RETURN json_build_object('error', 'no_campement'); END IF;

  DELETE FROM campement_fragments WHERE campement_id = v_camp.id AND fragment_id = p_fragment_id;

  PERFORM recalc_campement(v_camp.id);

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_fragment_from_campement(TEXT, INT) TO authenticated;

-- Laisser un message (livre d'or)
CREATE OR REPLACE FUNCTION public.leave_campement_message(
  p_user_id TEXT,
  p_campement_id INT,
  p_message TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM campements WHERE id = p_campement_id AND status = 'active') THEN
    RETURN json_build_object('error', 'campement_not_found');
  END IF;

  INSERT INTO campement_messages (campement_id, user_id, message)
  VALUES (p_campement_id, p_user_id, LEFT(TRIM(p_message), 500));

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_campement_message(TEXT, INT, TEXT) TO authenticated;

-- Bonus quotidien de visite (GPS sur son campement)
CREATE OR REPLACE FUNCTION public.visit_own_campement(
  p_user_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_camp RECORD;
  v_distance_km NUMERIC;
  v_already_today BOOLEAN;
  v_bonus INT := 10;
BEGIN
  SELECT * INTO v_camp FROM campements WHERE user_id = p_user_id AND status = 'active';
  IF v_camp.id IS NULL THEN RETURN json_build_object('error', 'no_campement'); END IF;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_camp.latitude, v_camp.longitude);
  IF v_distance_km > 0.2 THEN
    RETURN json_build_object('error', 'too_far');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id AND type = 'campement_visit' AND created_at::DATE = CURRENT_DATE
  ) INTO v_already_today;

  IF v_already_today THEN
    RETURN json_build_object('error', 'already_visited_today');
  END IF;

  -- Donner de l'influence a placer manuellement
  UPDATE users SET influence_stock = influence_stock + v_bonus WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('campement_visit', p_user_id, jsonb_build_object('influenceGain', v_bonus));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_bonus,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_own_campement(TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Verifier si un campement doit tomber
-- Appele periodiquement ou apres chaque place_influence_action
CREATE OR REPLACE FUNCTION public.check_campement_health(p_campement_id INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_camp RECORD;
  v_owner_faction TEXT;
  v_total_places INT;
  v_hostile_places INT;
  v_ruins_days INT;
BEGIN
  SELECT c.*, u.faction_id INTO v_camp, v_owner_faction
  FROM campements c JOIN users u ON u.id = c.user_id
  WHERE c.id = p_campement_id AND c.status = 'active';

  IF v_camp.id IS NULL THEN RETURN json_build_object('status', 'not_active'); END IF;

  -- Compter les lieux dans l'aura
  SELECT COUNT(*) INTO v_total_places
  FROM places p
  WHERE haversine_km(v_camp.latitude, v_camp.longitude, p.latitude, p.longitude) < (v_camp.radius_m::NUMERIC / 1000);

  IF v_total_places = 0 THEN RETURN json_build_object('status', 'safe', 'reason', 'no_places'); END IF;

  -- Compter les lieux ou la faction adverse domine
  SELECT COUNT(*) INTO v_hostile_places
  FROM places p
  WHERE haversine_km(v_camp.latitude, v_camp.longitude, p.latitude, p.longitude) < (v_camp.radius_m::NUMERIC / 1000)
    AND EXISTS (
      SELECT 1 FROM place_influence pi
      WHERE pi.place_id = p.id AND pi.faction_id != v_owner_faction
        AND (pi.placed_points + pi.content_points) > COALESCE(
          (SELECT placed_points + content_points FROM place_influence WHERE place_id = p.id AND faction_id = v_owner_faction), 0
        )
    );

  -- Si plus de la moitie des lieux sont hostiles → le campement tombe
  IF v_hostile_places > v_total_places / 2 THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'campement_ruins_days'), 7) INTO v_ruins_days;

    -- Retirer les bonus perennes
    -- (On retrouve les bonus via activity_log type campement_bonus)
    FOR r IN SELECT place_id, faction_id, (data->>'bonusPoints')::INT AS pts
      FROM activity_log WHERE type = 'campement_bonus' AND data->>'campementId' = p_campement_id::TEXT
    LOOP
      UPDATE place_influence SET content_points = GREATEST(0, content_points - r.pts)
      WHERE place_id = r.place_id AND faction_id = r.faction_id;
    END LOOP;
    DELETE FROM activity_log WHERE type = 'campement_bonus' AND data->>'campementId' = p_campement_id::TEXT;

    -- Retirer la gloire
    UPDATE users SET exploration_points = GREATEST(0, exploration_points - v_camp.glory_bonus)
    WHERE id = v_camp.user_id;

    -- Passer en ruines
    UPDATE campements SET
      status = 'ruins',
      ruins_until = NOW() + (v_ruins_days || ' days')::INTERVAL,
      glory_bonus = 0
    WHERE id = p_campement_id;

    -- Log
    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('campement_fallen', v_camp.user_id,
      jsonb_build_object('campementName', v_camp.name, 'campementId', p_campement_id));

    RETURN json_build_object('status', 'fallen', 'hostilePlaces', v_hostile_places, 'totalPlaces', v_total_places);
  END IF;

  RETURN json_build_object('status', 'safe', 'hostilePlaces', v_hostile_places, 'totalPlaces', v_total_places);
END;
$$;

-- Lister tous les campements pour la carte
CREATE OR REPLACE FUNCTION public.get_all_campements()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', c.id,
      'userId', c.user_id,
      'userName', COALESCE(u.first_name, u.email_address),
      'name', c.name,
      'latitude', c.latitude,
      'longitude', c.longitude,
      'radiusM', c.radius_m,
      'status', c.status,
      'factionId', u.faction_id,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'fragmentCount', (SELECT COUNT(*) FROM campement_fragments cf WHERE cf.campement_id = c.id),
      'userAvatar', u.avatar_url
    ))
    FROM campements c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    WHERE c.status = 'active'
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_campements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_campements() TO anon;
GRANT EXECUTE ON FUNCTION public.check_campement_health(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_campement(INT) TO authenticated;
```

- [ ] **Step 6: Appliquer la migration**

Run: `npx supabase db query --linked -f supabase/migrations/040_campements.sql`
Expected: Success, no errors

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/040_campements.sql
git commit -m "feat: campements schema + RPCs (create, get, fragments, visit, health check)"
```

---

## Phase 2 — Frontend: Store + Hook + Marqueurs carte

### Task 2: Store Zustand + Hook

**Files:**
- Create: `src/stores/campementStore.ts`
- Create: `src/hooks/useCampement.ts`

_(Code detaille lors de l'execution — interfaces typees pour campement, fragments, messages)_

- [ ] **Step 1: Creer le store** avec etat campements charges, campement selectionne, creation en cours
- [ ] **Step 2: Creer le hook** useCampement(campementId) qui fetch get_campement
- [ ] **Step 3: Creer le hook** useCampements() qui fetch get_all_campements pour la carte
- [ ] **Step 4: Commit**

### Task 3: Marqueurs campement sur la carte

**Files:**
- Create: `src/components/campement/CampementMarker.tsx`
- Modify: `src/components/map/ExploreMap.tsx`

- [ ] **Step 1: Creer CampementMarker** — icone tente + banniere faction + nom seigneurie
- [ ] **Step 2: Dessiner l'aura** — cercle colore (couleur faction, opacity faible) via une Source GeoJSON cercle
- [ ] **Step 3: Integrer dans ExploreMap** — charger campements, afficher marqueurs + auras
- [ ] **Step 4: Gerer le clic** — clic sur campement → ouvrir CampementPanel
- [ ] **Step 5: Commit**

---

## Phase 3 — CampementPanel (page riche)

### Task 4: Page campement

**Files:**
- Create: `src/components/campement/CampementPanel.tsx`
- Create: `src/components/campement/CampementPanel.css`
- Modify: `src/App.tsx`

Le panel s'ouvre comme PlacePanel (overlay modal). Contenu :

- [ ] **Step 1: Header** — nom seigneurie, avatar + nom du seigneur, banniere faction, statut (actif/ruines)
- [ ] **Step 2: Section Fragments** — grille des fragments places avec icones, noms, affinites terrain
- [ ] **Step 3: Section Lieux** — liste des lieux dans l'aura avec leur tag + influence faction
- [ ] **Step 4: Section Livre d'or** — messages des visiteurs + champ pour en laisser un
- [ ] **Step 5: Stats** — rayon, nb lieux, gloire bonus, nb fragments
- [ ] **Step 6: Actions** (si c'est mon campement) — placer/retirer fragments, renommer, visiter (GPS)
- [ ] **Step 7: Integrer dans App.tsx** — selectedCampementId dans mapStore → CampementPanel
- [ ] **Step 8: Commit**

### Task 5: Modal creation de campement

**Files:**
- Create: `src/components/campement/CreateCampementModal.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: UI** — carte miniature pour choisir l'emplacement, champ nom, affichage du cout
- [ ] **Step 2: Validation** — verifier qu'un lieu de sa faction est a proximite (feedback visuel)
- [ ] **Step 3: Appel RPC** create_campement + gestion erreurs
- [ ] **Step 4: Bouton dans la toolbar** ou FAB pour ouvrir la creation
- [ ] **Step 5: Commit**

---

## Phase 4 — Interactions

### Task 6: Check de sante apres placement d'influence

**Files:**
- Modify: `supabase/migrations/040_campements.sql` (ou nouvelle migration 041)

- [ ] **Step 1: Modifier place_influence_action** — apres chaque placement, verifier si un campement adverse est dans la zone et appeler check_campement_health
- [ ] **Step 2: Notification** — quand le campement tombe, log dans activity_log → toast pour le seigneur
- [ ] **Step 3: Trophee** — le joueur qui a fait basculer le lieu decisif gagne un bonus de Gloire
- [ ] **Step 4: Commit**

### Task 7: Alertes eclaireur

**Files:**
- Modify: `src/hooks/usePlayer.ts`

- [ ] **Step 1: Detecter dans l'activity_log** les placements d'influence dans la zone de mon campement par d'autres factions
- [ ] **Step 2: Toast** "Un joueur [faction] influence [lieu] dans votre seigneurie"
- [ ] **Step 3: Commit**

---

## Phase 5 — Leaderboard + Hub

### Task 8: Classement des seigneuries

**Files:**
- Modify: `src/components/map/LeaderboardModal.tsx`

- [ ] **Step 1: Nouvel onglet "Seigneuries"** dans le leaderboard
- [ ] **Step 2: RPC get_leaderboard** avec p_type = 'seigneuries' — classe par Rayonnement (activite 30j dans l'aura)
- [ ] **Step 3: Commit**

### Task 9: Hub — Config affinites fragments/tags

**Files:**
- Create: `apps/hub/src/components/FragmentAffinities.tsx`
- Modify: `apps/hub/src/App.tsx` (route)

- [ ] **Step 1: Interface** — tableau fragments × tags avec bonus_points editable
- [ ] **Step 2: CRUD** — lecture/ecriture dans fragment_tag_affinities via Supabase
- [ ] **Step 3: Settings campement** dans la page Settings existante
- [ ] **Step 4: Commit**

---

## Resume des mecaniques

| Action | Effet |
|--------|-------|
| Creer un campement | Coute de l'influence, pose un marqueur + aura |
| Placer un fragment | Aura grandit + bonus perennes sur lieux du bon tag |
| Visiter son campement (GPS) | +10 influence a placer manuellement |
| Adversaire place influence sur lieux de la zone | Risque de faire tomber le campement |
| Campement tombe | Bonus perennes retires, gloire perdue, ruines 7j |
| Visiteur laisse un message | Livre d'or |
| Tributaire (futur) | Allie depense influence pour renforcer le campement |
