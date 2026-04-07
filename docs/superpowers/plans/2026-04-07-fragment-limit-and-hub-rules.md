# Fragment Limit Bonus + Hub Game Rules Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fragments increase remote influence limit on matching places instead of giving free daily stock. New Hub page to view/edit all game rules.

**Architecture:** Fragment affinities (`fragment_tag_affinities.bonus_points`) become extra remote clicks on places with matching tags. The daily claim RPC is dropped. A new Hub page reads all `app_settings` rows, groups them by category, and lets the admin edit + save.

**Tech Stack:** PostgreSQL (Supabase RPC), React 18 + TypeScript, Zustand, CSS

---

### Task 1: SQL — Fragments augmentent la limite remote d'influence

**Files:**
- Create: `supabase/migrations/045_fragment_influence_limit.sql`

**Context:** Currently `place_influence_action` has a hard limit of `influence_max_remote_per_day` (default 5) per place when remote. Fragment affinities (`fragment_tag_affinities`) link a fragment to tags with `bonus_points`. We change the meaning: `bonus_points` = extra remote clicks the player gets on places with that tag.

- [ ] **Step 1: Write migration that rewrites `place_influence_action`**

```sql
-- 045_fragment_influence_limit.sql
-- Fragments augmentent la limite remote par lieu via tag affinities.
-- bonus_points dans fragment_tag_affinities = clics remote supplémentaires.
-- Suppression de claim_daily_fragment_bonus (plus de gains gratuits).

CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id TEXT,
  p_place_id TEXT,
  p_points INT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_target_faction_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction_id TEXT;
  v_target_faction TEXT;
  v_stock INT;
  v_is_gps BOOLEAN := FALSE;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_base_remote INT;
  v_fragment_bonus INT := 0;
  v_max_remote INT;
  v_today_remote INT;
  v_actual_points INT;
  v_place_title TEXT;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_faction_title TEXT;
BEGIN
  SELECT faction_id, influence_stock INTO v_user_faction_id, v_stock
  FROM users WHERE id = p_user_id;

  IF v_user_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  v_target_faction := COALESCE(p_target_faction_id, v_user_faction_id);

  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = v_target_faction) THEN
    RETURN json_build_object('error', 'invalid_faction');
  END IF;

  IF v_stock < p_points OR p_points <= 0 THEN
    RETURN json_build_object('error', 'not_enough_influence', 'stock', v_stock);
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_is_gps := v_distance_km < 0.2;
  END IF;

  IF NOT v_is_gps THEN
    -- Base limit
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_max_remote_per_day'), 5)
    INTO v_base_remote;

    -- Fragment bonus: sum bonus_points from player's fragments whose tags match this place
    SELECT COALESCE(SUM(fta.bonus_points), 0) INTO v_fragment_bonus
    FROM user_fragments uf
    JOIN fragment_tag_affinities fta ON fta.fragment_id = uf.fragment_id
    WHERE uf.user_id = p_user_id
      AND fta.tag_id IN (SELECT tag_id FROM place_tags WHERE place_id = p_place_id);

    v_max_remote := v_base_remote + v_fragment_bonus;

    SELECT COALESCE(SUM((data->>'points')::INT), 0) INTO v_today_remote
    FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'place_influence'
      AND place_id = p_place_id
      AND (data->>'remote')::BOOLEAN = TRUE
      AND created_at::DATE = CURRENT_DATE;

    v_actual_points := LEAST(p_points, v_max_remote - v_today_remote);
    IF v_actual_points <= 0 THEN
      RETURN json_build_object('error', 'daily_remote_limit', 'remaining', GREATEST(0, v_max_remote - v_today_remote));
    END IF;
  ELSE
    v_actual_points := p_points;
    v_fragment_bonus := 0;
    v_base_remote := 0;
  END IF;

  UPDATE users SET influence_stock = influence_stock - v_actual_points
  WHERE id = p_user_id;

  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_target_faction, v_actual_points, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_actual_points,
               updated_at = NOW();

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern_url, title INTO v_faction_color, v_faction_pattern, v_faction_title
  FROM factions WHERE id = v_target_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('place_influence', p_user_id, p_place_id, v_target_faction,
    jsonb_build_object(
      'points', v_actual_points,
      'remote', NOT v_is_gps,
      'gps', v_is_gps,
      'target_faction', v_target_faction,
      'own_faction', v_user_faction_id,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'factionTitle', v_faction_title
    ));

  RETURN json_build_object(
    'success', true,
    'pointsPlaced', v_actual_points,
    'remainingStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'gps', v_is_gps,
    'maxRemote', CASE WHEN NOT v_is_gps THEN v_base_remote + v_fragment_bonus ELSE NULL END,
    'fragmentBonus', v_fragment_bonus,
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

GRANT EXECUTE ON FUNCTION public.place_influence_action(TEXT, TEXT, INT, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- Drop the daily claim function (no longer needed)
DROP FUNCTION IF EXISTS public.claim_daily_fragment_bonus(TEXT);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db query --linked -f supabase/migrations/045_fragment_influence_limit.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/045_fragment_influence_limit.sql
git commit -m "feat: fragments increase remote influence limit instead of daily stock bonus"
```

---

### Task 2: Frontend — Mettre à jour le texte d'influence avec la limite fragment

**Files:**
- Modify: `apps/explore-web/src/components/places/InfluenceFrame.tsx`

**Context:** The influence frame shows "encore X clics sur ce lieu" for remote. Now the max can vary per place (base + fragment bonus). The RPC now returns `maxRemote` and `fragmentBonus`. We need to show the real remaining count. Also remove any reference to `claim_daily_fragment_bonus` from the codebase.

- [ ] **Step 1: Update InfluenceFrame stock text to account for variable limit**

In `InfluenceFrame.tsx`, the current `MAX_REMOTE_PER_PLACE = 5` is hardcoded. Replace with a dynamic value fetched from the RPC response, or computed from `remoteUsed` vs server-returned max.

The simplest approach: when we load `remoteUsed` at mount, also fetch the player's fragment bonus for this place. But to keep it simple, we can just change the RPC response handling to update `maxRemote` when influence is placed, and keep using the base 5 as default until the first response comes.

```tsx
// Replace the hardcoded constant
const [maxRemote, setMaxRemote] = useState(5)

// In the useEffect that loads remote usage, also compute fragment bonus
// For now, keep it at 5 — it updates on first click from the RPC response

// After successful RPC call, update maxRemote from response:
// const result = data as { maxRemote?: number; fragmentBonus?: number; ... }
// if (result.maxRemote != null) setMaxRemote(result.maxRemote)

// Update stock text to use maxRemote instead of MAX_REMOTE_PER_PLACE
```

- [ ] **Step 2: Remove any `claim_daily_fragment_bonus` call from usePlayer.ts or App.tsx**

Search for `claim_daily_fragment_bonus` and `fragment_daily_bonus` in the codebase and remove calls + UI.

- [ ] **Step 3: Build and verify**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/
git commit -m "feat: influence frame shows dynamic remote limit from fragments"
```

---

### Task 3: Hub — Page "Règles du Jeu" complète

**Files:**
- Create: `apps/hub/src/components/GameRules.tsx`
- Modify: `apps/hub/src/App.tsx` (add route)

**Context:** The current Settings.tsx has settings split across many sections with hardcoded keys. We want a single "Règles du jeu" page that:
1. Loads ALL rows from `app_settings`
2. Groups them by prefix category (e.g., `influence_*`, `exploration_*`, `enigma_*`, etc.)
3. Shows each setting as an editable row: key, current value, description
4. Save button per section (upserts to `app_settings`)

The descriptions are hardcoded in the component (a mapping `key → description` in French).

- [ ] **Step 1: Create GameRules.tsx**

A single component that:
- Fetches `SELECT key, value FROM app_settings ORDER BY key`
- Groups by prefix (before first `_` or known category)
- Renders each group as a card with title, and each setting as a labeled input
- Has a "Sauvegarder" button per group
- Uses the existing Hub CSS patterns (`divers-card`, `settings-table`, `btn-primary`)

Category grouping:
- `distance_*` → "Coût par distance"
- `energy_*` → "Énergie"
- `exploration_*` → "Exploration"
- `erudition_*` → "Érudition"
- `influence_*` → "Influence"
- `enigma_*` → "Énigmes"
- `fragment_*` → "Fragments"
- `faction_*` → "Héritage"
- `glory_*` → "Gloire (legacy)"
- `default_*` → "Défauts globaux"
- Other → "Divers"

French descriptions mapping (hardcoded dict):
```typescript
const DESCRIPTIONS: Record<string, string> = {
  influence_max_remote_per_day: 'Limite de clics d\'influence à distance par jour et par lieu',
  influence_decay_per_week: 'Points d\'influence active perdus par semaine (decay)',
  influence_visit_gps: 'Stock d\'influence gagné pour une visite GPS',
  influence_add_place: 'Stock d\'influence gagné pour l\'ajout d\'un lieu (GPS < 500m)',
  influence_revisit_gps: 'Base d\'influence placée pour une re-visite GPS',
  exploration_gps_bonus: 'Points d\'exploration bonus pour une découverte sur place',
  exploration_visit_gps: 'Points d\'exploration pour une visite GPS',
  exploration_add_photo: 'Points d\'exploration pour l\'ajout d\'une photo',
  exploration_add_carnet: 'Points d\'exploration pour l\'ajout d\'un récit',
  erudition_add_carnet: 'Points d\'érudition pour l\'ajout d\'un récit',
  enigma_influence_easy: 'Influence gagnée pour une énigme facile réussie',
  enigma_influence_medium: 'Influence gagnée pour une énigme moyenne réussie',
  enigma_influence_hard: 'Influence gagnée pour une énigme difficile réussie',
  enigma_erudition_easy: 'Érudition gagnée pour une énigme facile réussie',
  enigma_erudition_medium: 'Érudition gagnée pour une énigme moyenne réussie',
  enigma_erudition_hard: 'Érudition gagnée pour une énigme difficile réussie',
  enigma_place_influence_base: 'Influence base pour une énigme de lieu',
  enigma_place_influence_per_diff: 'Influence supplémentaire par niveau de difficulté (lieu)',
  enigma_place_erudition_base: 'Érudition base pour une énigme de lieu',
  enigma_place_erudition_per_diff: 'Érudition supplémentaire par niveau de difficulté (lieu)',
  fragment_enigma_influence: 'Influence gagnée pour une énigme de fragment réussie',
  fragment_enigma_erudition: 'Érudition gagnée pour une énigme de fragment réussie',
  fragment_enigma_cooldown_hours: 'Heures de cooldown entre deux énigmes d\'un même fragment',
  fragment_affinity_bonus_default: 'Clics remote supplémentaires par affinité de fragment',
  faction_change_cooldown_days: 'Jours de cooldown entre deux changements d\'héritage',
  energy_base_cycle: 'Secondes pour régénérer 1 point d\'énergie',
  default_max_energy: 'Énergie max par défaut pour les nouveaux joueurs',
  distance_gps_km: 'Rayon GPS "sur place" (km)',
  distance_close_km: 'Rayon zone "proche" (km)',
  distance_mid_km: 'Rayon zone "moyen" (km)',
  distance_mult_gps: 'Multiplicateur coût GPS',
  distance_mult_close: 'Multiplicateur coût proche',
  distance_mult_mid: 'Multiplicateur coût moyen',
  distance_mult_far: 'Multiplicateur coût lointain',
}
```

- [ ] **Step 2: Add route in App.tsx**

```tsx
import { GameRules } from './components/GameRules'
// In the router:
<Route path="/rules" element={<GameRules />} />
// In the nav:
<NavLink to="/rules">Règles</NavLink>
```

- [ ] **Step 3: Build and verify**

```bash
pnpm --filter hub build
```

- [ ] **Step 4: Commit**

```bash
git add apps/hub/src/
git commit -m "feat(hub): game rules page — all app_settings editable in one place"
```

---

### Task 4: Cleanup — Retirer les settings legacy des paliers de collection

**Files:**
- Modify: `apps/hub/src/components/Settings.tsx` (remove fragment collection section)
- Modify: `apps/explore-web/src/hooks/usePlayer.ts` (remove daily fragment claim if present)

**Context:** The fragment_collection_1/2/3/4 settings and claim_daily_fragment_bonus are dead code now. Clean up.

- [ ] **Step 1: Remove the "Fragments — Bonus quotidiens" card from Settings.tsx**

Remove the v05Fragments state (collection paliers part), the card at lines ~894-937, and the save logic for those keys.
Keep `fragment_enigma_influence` and `fragment_enigma_erudition` — move them to the Enigmes section.

- [ ] **Step 2: Remove any daily fragment claim call from explore-web**

Search and remove `claim_daily_fragment_bonus` calls, `fragment_daily_bonus` handling in usePlayer.ts.

- [ ] **Step 3: Build both apps**

```bash
pnpm build
pnpm --filter hub build
```

- [ ] **Step 4: Commit**

```bash
git add apps/
git commit -m "chore: remove dead fragment daily bonus code and collection palier settings"
```
