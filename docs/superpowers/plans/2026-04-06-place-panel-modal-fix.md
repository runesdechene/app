# PlacePanel — Modal UX Fix + Data Backfill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform PlacePanel from a sliding side-panel into a proper centered modal with overlay, fix broken buttons (influence + explorers), and backfill discoverer's carnet/explorers for existing places.

**Architecture:** CSS-only modal transformation (fade+scale, overlay with backdrop-blur). Fix InfluenceButton visibility bug. SQL backfill migration to populate `place_explorers` and `place_contributions` from existing `places` data. Update `get_place_detail_v05` to return `images` JSONB.

**Tech Stack:** React 18 · CSS · PostgreSQL (Supabase RPCs) · TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/explore-web/src/components/places/PlacePanel.tsx` | Modify | Overlay wrapper, icon toolbar, InfluenceButton visibility |
| `apps/explore-web/src/components/places/PlacePanel.css` | Modify | Fade animation, overlay, centered modal, toolbar row |
| `supabase/migrations/020_backfill_explorers_and_carnets.sql` | Create | Backfill place_explorers + place_contributions + update RPC |

---

### Task 1: Overlay + fade animation (CSS)

**Files:**
- Modify: `apps/explore-web/src/components/places/PlacePanel.css:1-34`

- [ ] **Step 1: Replace slide animation with fade + overlay**

Replace the shell section (lines 1-34) in `PlacePanel.css`:

```css
/* ==========================================
   PLACE PANEL — Shell
   ========================================== */

.place-panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 19;
  background: rgba(20, 12, 5, 0.45);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  animation: place-panel-fade-in 0.2s ease;
}

@keyframes place-panel-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes place-panel-appear {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.place-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.96);
  width: 700px;
  max-height: calc(100vh - 70px);
  border-radius: 20px;
  background-color: var(--color-parchment);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 20px 60px rgba(74, 55, 40, 0.3);
  z-index: 20;
  opacity: 0;
  pointer-events: none;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
}

.place-panel::-webkit-scrollbar {
  display: none;
}

.place-panel-open {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
  animation: place-panel-appear 0.25s ease;
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/explore-web && pnpm build`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/PlacePanel.css
git commit -m "feat: PlacePanel modal — fade animation + overlay backdrop"
```

---

### Task 2: Overlay click-to-close

**Files:**
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx:34-56`

- [ ] **Step 1: Wire backdrop click to onClose**

In `PlacePanel.tsx`, replace the backdrop `<div>` (line 36) with an onClick handler:

```tsx
{isOpen && <div className="place-panel-backdrop" onClick={onClose} />}
```

Where `onClose` comes from props. The PlacePanel function signature already has `onClose` in props, but it's passed down to PlaceContent only. We need to use it here too.

The current code at line 30-57:
```tsx
export function PlacePanel({ placeId, onClose, userEmail, onAuthPrompt }: PlacePanelProps) {
  const { place, loading, error, refetch } = usePlace(placeId)
  const isOpen = placeId !== null

  return (
    <>
      {isOpen && <div className="place-panel-backdrop" onClick={onClose} />}

      <div className={`place-panel ${isOpen ? 'place-panel-open' : ''}`}>
```

Only change: add `onClick={onClose}` on the backdrop div.

- [ ] **Step 2: Verify build**

Run: `cd apps/explore-web && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: PlacePanel overlay click-to-close"
```

---

### Task 3: Toolbar row — move close, gear, bookmark below hero

**Files:**
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx:342-425` (hero section) and `420-430` (identity section)
- Modify: `apps/explore-web/src/components/places/PlacePanel.css`

- [ ] **Step 1: Restructure hero + add toolbar row in TSX**

In `DiscoveredPlaceContent`, replace the hero section (lines 342-416) to remove close/gear buttons from hero, and add a toolbar between hero and body:

**New hero section** — only rating pill + gallery navigation remain:
```tsx
{/* Zone 1 — Hero Photo */}
<div className="place-hero">
  {heroPhotoUrl ? (
    <img
      src={heroPhotoUrl}
      alt={place.title}
      className="place-hero-img"
      loading="lazy"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    <div className="place-hero-placeholder" />
  )}

  {/* Top-left: rating pill */}
  <div className="place-hero-top-left">
    {avgRating !== null && (
      <span className="place-hero-pill place-hero-rating">
        ★ {avgRating.toFixed(1)}
      </span>
    )}
  </div>

  {/* Gallery dots */}
  {currentHeroPhotos.length > 1 && (
    <div className="place-hero-dots">
      {currentHeroPhotos.map((_, i) => (
        <button
          key={i}
          className={`place-hero-dot${i === (imageIndex % currentHeroPhotos.length) ? ' active' : ''}`}
          onClick={() => setImageIndex(i)}
        />
      ))}
    </div>
  )}

  {/* Gallery nav arrows */}
  {currentHeroPhotos.length > 1 && (
    <>
      <button className="place-hero-nav place-hero-prev" onClick={prevHero}>&#8249;</button>
      <button className="place-hero-nav place-hero-next" onClick={nextHero}>&#8250;</button>
    </>
  )}
</div>

{/* Toolbar row: bookmark left — gear + close right */}
<div className="place-toolbar">
  <div className="place-toolbar-left">
    {v05 && (
      <WishlistButton placeId={place.id} isWishlisted={v05.isWishlisted} />
    )}
  </div>
  <div className="place-toolbar-right">
    {isAdmin && (
      <div className="place-options-wrap">
        <button
          className="place-toolbar-btn"
          onClick={() => setShowOptionsMenu(v => !v)}
          aria-label="Options"
        >
          {'\u2699\uFE0F'}
        </button>
        {showOptionsMenu && (
          <>
            <div className="place-options-backdrop" onClick={() => setShowOptionsMenu(false)} />
            <div className="place-options-menu">
              <button
                className="place-options-item danger"
                onClick={() => { setShowOptionsMenu(false); setShowDeleteConfirm(true) }}
              >
                Supprimer ce lieu
              </button>
            </div>
          </>
        )}
      </div>
    )}
    <button onClick={onClose} className="place-toolbar-btn" aria-label="Fermer">
      &#10005;
    </button>
  </div>
</div>
```

Also remove the `<WishlistButton>` from the title-row in the identity section (line ~424-427). The title row becomes just:
```tsx
<div className="place-title-row">
  <h2 className="place-title">{place.title}</h2>
</div>
```

- [ ] **Step 2: Add toolbar CSS**

Append to `PlacePanel.css`, after the hero section:

```css
/* ==========================================
   TOOLBAR (below hero)
   ========================================== */

.place-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-parchment-dark);
}

.place-toolbar-left,
.place-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.place-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: 1px solid var(--color-parchment-dark);
  border-radius: 50%;
  font-size: 15px;
  color: var(--color-ink-light);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.place-toolbar-btn:hover {
  background: var(--color-parchment-dark);
  color: var(--color-ink);
}
```

Also remove the now-unused `.place-hero-top-right` and `.place-hero-close` CSS rules (they still exist in the hero section but aren't used anymore).

- [ ] **Step 3: Verify build**

Run: `cd apps/explore-web && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/places/PlacePanel.tsx apps/explore-web/src/components/places/PlacePanel.css
git commit -m "feat: PlacePanel toolbar — bookmark left, gear+close right below hero"
```

---

### Task 4: Fix InfluenceButton visibility

**Files:**
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx:559-568`

The InfluenceButton is currently wrapped in `<div style={{ display: 'none' }}>`, making it permanently invisible. It should render normally when `showInfluenceAction` is true.

- [ ] **Step 1: Remove display:none wrapper, add close handler**

Replace lines 559-568 in PlacePanel.tsx:

```tsx
{/* InfluenceButton action panel */}
{showInfluenceAction && userEmail && (
  <InfluenceButton
    placeId={place.id}
    placeLocation={place.location}
    onInfluencePlaced={() => { refreshV05(); onRefetch(); setShowInfluenceAction(false) }}
  />
)}
```

Remove the `usePlayerStore.getState().gameMode === 'conquest'` guard — the InfluenceFrame already has this check and only fires the event in conquest mode.

- [ ] **Step 2: Verify build**

Run: `cd apps/explore-web && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "fix: InfluenceButton was hidden by display:none wrapper"
```

---

### Task 5: SQL backfill — explorers + discoverer's carnet + update RPC

**Files:**
- Create: `supabase/migrations/020_backfill_explorers_and_carnets.sql`

This migration does 3 things:
1. Backfill `place_explorers` for all existing place authors
2. Backfill `place_contributions` (type='carnet') using each place's `text` (description) and `images` JSONB
3. Update `get_place_detail_v05` to include the `images` JSONB column in contributions

- [ ] **Step 1: Write the migration**

```sql
-- 020_backfill_explorers_and_carnets.sql
-- Backfill: place authors → explorers + discoverer's carnet from places.text/images
-- Also update get_place_detail_v05 to return images JSONB on contributions

-- 1. Backfill place_explorers: every place author becomes an explorer
INSERT INTO place_explorers (place_id, user_id, visited_at)
SELECT p.id, p.author_id, p.created_at
FROM places p
WHERE p.author_id IS NOT NULL
ON CONFLICT (place_id, user_id) DO NOTHING;

-- 2. Backfill place_contributions: discoverer's carnet from places.text + images
--    Only insert where no carnet already exists for that author+place
INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, created_at)
SELECT
  p.id,
  p.author_id,
  u.faction_id,
  'carnet',
  COALESCE(NULLIF(TRIM(p.text), ''), 'Lieu découvert.'),
  COALESCE(
    (SELECT jsonb_agg(img->>'url') FROM jsonb_array_elements(p.images) AS img WHERE img->>'url' IS NOT NULL),
    '[]'::jsonb
  ),
  p.created_at
FROM places p
JOIN users u ON u.id = p.author_id
WHERE p.author_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM place_contributions pc
    WHERE pc.place_id = p.id AND pc.user_id = p.author_id AND pc.type = 'carnet'
  )
ON CONFLICT (place_id, user_id, type) DO NOTHING;

-- 3. Update get_place_detail_v05: add images to contributions JSON
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
  -- Influence par héritage
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

  -- Contributions (triées par votes) — NOW INCLUDES images JSONB
  SELECT json_agg(
    json_build_object(
      'id', pc.id,
      'userId', pc.user_id,
      'factionId', pc.faction_id,
      'type', pc.type,
      'content', pc.content,
      'imageUrl', pc.image_url,
      'images', COALESCE(pc.images, '[]'::jsonb),
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

  -- Gardien (top contributeur)
  SELECT pc.user_id, u.first_name AS name, u.avatar_url, u.faction_id,
    SUM(pc.votes_up) AS total_votes
  INTO v_guardian
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id
  GROUP BY pc.user_id, u.first_name, u.avatar_url, u.faction_id
  ORDER BY total_votes DESC
  LIMIT 1;

  -- Infos joueur connecté
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

- [ ] **Step 2: Apply migration via SQL Editor**

Copy the content of `020_backfill_explorers_and_carnets.sql` into Supabase SQL Editor and execute it.

Verify:
```sql
SELECT COUNT(*) FROM place_explorers;          -- Should be >= number of places
SELECT COUNT(*) FROM place_contributions WHERE type = 'carnet';  -- Should be >= number of places
SELECT * FROM place_contributions WHERE type = 'carnet' LIMIT 3; -- Check images array is populated
```

- [ ] **Step 3: Mark migration as applied**

```bash
npx supabase migration repair 020_backfill_explorers_and_carnets --status applied
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_backfill_explorers_and_carnets.sql
git commit -m "feat: backfill explorers + discoverer carnets + RPC returns images"
```

---

### Task 6: Frontend — use images array from RPC

**Files:**
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx:210-229`

The `carnets` mapping already handles `images` at line 221:
```tsx
images: c.images ?? (c.imageUrl ? [c.imageUrl] : []),
```

This already works with the `images` field. The RPC now returns it. No frontend change needed for this — the existing code is correct.

**Verify:** After applying the migration, open a place in the app and check:
- Explorers count > 0 (at least the author)
- Carnets tab shows the discoverer's carnet
- Gallery tab shows photos from the discoverer's carnet

- [ ] **Step 1: Verify build**

Run: `cd apps/explore-web && pnpm build`

- [ ] **Step 2: Manual QA checklist**

Open `pnpm dev` and check:
1. Modal appears with fade animation (not slide)
2. Dark overlay behind modal, click overlay = close
3. Bookmark icon on left of toolbar below hero
4. Gear + close icons on right of toolbar below hero
5. "Placer de l'influence" button shows slider+submit when clicked
6. Explorers count shows at least the place author
7. Carnets tab has the discoverer's original text
8. Gallery shows photos from the discoverer's carnet

---

## Summary

| Task | What | Type |
|------|------|------|
| 1 | Overlay + fade animation | CSS |
| 2 | Click overlay to close | TSX (1 line) |
| 3 | Toolbar: bookmark left, gear+close right | TSX + CSS |
| 4 | Fix InfluenceButton hidden by display:none | TSX (remove wrapper) |
| 5 | SQL backfill explorers + carnets + RPC images | SQL migration |
| 6 | Verify frontend picks up images correctly | QA |
