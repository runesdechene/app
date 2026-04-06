# Phase 6 — Influence Migration (Kill Old Claims)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old V0.4 claim-based territory system with V0.5 influence-based coloring. Clear all legacy claims. Map colors now driven entirely by `place_influence`.

**Architecture:** Update `get_map_places` RPC to return influence data + dominant faction. Update `usePlaces.ts` to use influence for coloring. Update `ExploreMap.tsx` to send influence data to worker (not just "claimed" places). Clean up worker scoring. Reset old claims in DB. Tune radius constants.

**Tech Stack:** PostgreSQL (Supabase RPC) · TypeScript · Web Workers

---

## File Map

| File | Action | What |
|------|--------|------|
| `supabase/migrations/022_phase6_influence_map.sql` | Create | New RPC + reset old claims |
| `apps/explore-web/src/hooks/usePlaces.ts` | Modify | Parse influence fields, color by dominant faction |
| `apps/explore-web/src/components/map/ExploreMap.tsx` | Modify | Send all places with influence to worker |
| `apps/explore-web/src/workers/territoryWorker.ts` | Modify | Remove V0.4 fallback, tune radius |

---

### Task 1: SQL — Update `get_map_places` + reset claims

**Files:**
- Create: `supabase/migrations/022_phase6_influence_map.sql`

- [ ] **Step 1: Write the migration**

The RPC has 3 branches (popular, latest, all) that build the same JSON object. We need to:
1. Add a subquery for influence data to the JSON output
2. Replace `faction` (from `places.faction_id` claim) with the dominant faction from `place_influence`
3. Reset all old claims on `places` table

```sql
-- 022_phase6_influence_map.sql
-- Phase 6: Map driven by influence, not claims. Reset all V0.4 claims.

-- 1. Reset old claims on places (keep faction_id column but null it out)
UPDATE places SET
  faction_id = NULL,
  claimed_by = NULL,
  claimed_at = NULL,
  claimed_avatar_url = NULL,
  fortification_level = 0;

-- 2. Rewrite get_map_places to use influence for faction coloring
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Helper CTE: dominant faction per place (from place_influence)
  -- Used by all branches

  IF p_type = 'all' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        -- V0.5: faction = dominant faction by influence (not old claim)
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id,
            'title', dom.faction_title,
            'color', dom.faction_color,
            'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        -- V0.5: influence data for territory worker
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      -- Dominant faction subquery
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi
        JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC
        LIMIT 1
      ) dom ON true
      -- Influence aggregates
      LEFT JOIN LATERAL (
        SELECT
          SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi
        WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id, 'title', dom.faction_title,
            'color', dom.faction_color, 'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC LIMIT 1
      ) dom ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, dom.faction_id, dom.faction_title, dom.faction_color, dom.faction_pattern,
        inf.total_influence, inf.by_faction, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSE -- 'latest' and default
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id, 'title', dom.faction_title,
            'color', dom.faction_color, 'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC LIMIT 1
      ) dom ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_places(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_places(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT) TO anon;
```

- [ ] **Step 2: Apply migration to Supabase**

Run in SQL Editor. Verify:
```sql
SELECT id, get_map_places->'totalInfluence', get_map_places->'faction' FROM ... LIMIT 3;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/022_phase6_influence_map.sql
git commit -m "feat: Phase 6 — get_map_places returns influence data, reset old claims"
```

---

### Task 2: Frontend — usePlaces parses influence data

**Files:**
- Modify: `apps/explore-web/src/hooks/usePlaces.ts`

- [ ] **Step 1: Add influence fields to MapPlace + PlaceProperties**

In `MapPlace` interface, add:
```typescript
totalInfluence: number
influenceByFaction: Record<string, number>
```

In `PlaceProperties` interface, add:
```typescript
totalInfluence: number
influenceByFaction: Record<string, number>
```

- [ ] **Step 2: Parse influence fields in fetchPlaces**

In the `properties` mapping (line 110-128), add:
```typescript
totalInfluence: place.totalInfluence ?? 0,
influenceByFaction: place.influenceByFaction ?? {},
```

Also update the `claimed` logic — a place is now "claimed" if it has influence (not just a faction from the old system):
```typescript
claimed: !!place.faction || (place.totalInfluence ?? 0) > 0,
```

- [ ] **Step 3: Build + commit**

```bash
cd apps/explore-web && pnpm build
git add apps/explore-web/src/hooks/usePlaces.ts
git commit -m "feat: usePlaces parses totalInfluence + influenceByFaction"
```

---

### Task 3: Frontend — ExploreMap sends influence data to worker

**Files:**
- Modify: `apps/explore-web/src/components/map/ExploreMap.tsx:359-382`

- [ ] **Step 1: Update worker message to include influence fields**

In the `workerRef.current.postMessage` block, change the filter to include all places with influence OR old claims, and add influence fields:

Replace the filter + map:
```typescript
workerRef.current.postMessage({
  features: rawGeojson.features
    .filter(f => {
      const ov = placeOverrides.get(f.properties.id)
      // V0.5: include places with influence OR overrides
      return f.properties.claimed || (f.properties.totalInfluence ?? 0) > 0 || ov?.claimed
    })
    .map(f => {
      const ov = placeOverrides.get(f.properties.id)
      return {
        coordinates: f.geometry.coordinates as [number, number],
        placeId: f.properties.id,
        faction: ov?.factionId || f.properties.factionId,
        factionTitle: f.properties.tagTitle,
        tagColor: ov?.tagColor || f.properties.tagColor,
        factionPattern: ov?.factionPattern || f.properties.factionPattern,
        score: Math.max(ov?.score ?? f.properties.score, (ov?.claimed || f.properties.claimed) ? 1 : 0),
        likes: f.properties.likes ?? 0,
        fortificationLevel: ov?.fortificationLevel ?? f.properties.fortificationLevel ?? 0,
        claimedByName: f.properties.claimedByName,
        claimedById: f.properties.claimedById,
        // V0.5 influence data
        totalInfluence: f.properties.totalInfluence ?? 0,
        influenceByFaction: f.properties.influenceByFaction ?? {},
      }
    }),
  tiers: territoryTiers,
})
```

- [ ] **Step 2: Build + commit**

```bash
cd apps/explore-web && pnpm build
git add apps/explore-web/src/components/map/ExploreMap.tsx
git commit -m "feat: ExploreMap sends influence data to territory worker"
```

---

### Task 4: Worker — influence-only scoring + tuned radius

**Files:**
- Modify: `apps/explore-web/src/workers/territoryWorker.ts:17-149`

- [ ] **Step 1: Tune radius constants for influence scale**

Influence scores are typically 10-50 (carnet=10, photo=5, clicks=1). The old score system had values 1-100+ with fortification bonuses. Adjust:

```typescript
const BASE_RADIUS_KM = 0.20      // ~120m minimum (slightly smaller base)
const RADIUS_SCALE_KM = 0.12     // gentler growth — influence grows faster than old scores
```

Old formula: `r = 0.25 + sqrt(score-1) * 0.65` → score 10 = 2.2km, score 50 = 4.8km (way too big)
New formula: `r = 0.20 + sqrt(score-1) * 0.12` → score 10 = 0.56km, score 50 = 1.04km (reasonable)

- [ ] **Step 2: Simplify getPlaceScore — influence only, no V0.4 fallback**

```typescript
function getPlaceScore(place: PlaceInput): number {
  if (place.totalInfluence != null && place.totalInfluence > 0) {
    return place.totalInfluence
  }
  // No influence yet — minimal presence
  return 1
}
```

Remove the `fortificationBonus` function entirely (dead code).

- [ ] **Step 3: Build + commit**

```bash
cd apps/explore-web && pnpm build
git add apps/explore-web/src/workers/territoryWorker.ts
git commit -m "feat: territory worker — influence-only scoring, tuned radius"
```

---

### Task 5: Build verification + manual QA

- [ ] **Step 1: Full build**

```bash
cd apps/explore-web && pnpm build
```

- [ ] **Step 2: QA checklist with `pnpm dev`**

1. Map loads — no old claim colors visible
2. Places with influence show faction colors on the map
3. Territory blobs appear around influenced places (sized reasonably)
4. Clicking a place banner still works (influence goes up, territory might grow)
5. Places without any influence show neutral/tag color
6. Dominant faction banner appears on territory blobs

---

## Summary

| Task | What | Risk |
|------|------|------|
| 1 | SQL: New `get_map_places` + reset claims | High — destructive DB change |
| 2 | usePlaces: parse influence fields | Low |
| 3 | ExploreMap: send influence to worker | Low |
| 4 | Worker: influence-only scoring + radius | Medium — tuning |
| 5 | QA | — |
