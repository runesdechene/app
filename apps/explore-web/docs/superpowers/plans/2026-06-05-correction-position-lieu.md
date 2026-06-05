# Correction de la position d'un lieu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'auteur d'un lieu, ou à tout joueur l'ayant visité, de corriger sa position géographique — édition immédiate, trace en lecture seule, notification auteur + veilleur.

**Architecture:** Une migration SQL 214 (table `place_position_history` + RPC `update_place_position` `SECURITY DEFINER` + extension de `get_place_detail_v05`). Côté front, on réutilise le mode plein écran `addPlaceMode` existant via un discriminateur `mapPickerPurpose` ; le viseur d'`AddPlaceFlow` est factorisé en `MapCrosshairPicker` partagé, consommé par `AddPlaceFlow` et le nouveau `EditPositionFlow`. Le point d'entrée est un item conditionnel du menu d'adresse de `PlacePanel`.

**Tech Stack:** React 18 + Vite + TypeScript strict, Zustand (`mapStore`), Supabase (Postgres RPC `SECURITY DEFINER`), MapLibre GL, Nominatim (reverse-geocoding), Vitest.

---

## Décisions verrouillées (reality-check du 2026-06-05)

- **RPC détail réelle** : `get_place_detail_v05(p_place_id text, p_user_id text)` — dernière def dans `supabase/migrations/199_place_description_contributors.sql`.
- **Éligibilité front** : calculée à partir de l'existant (`isAuthor = place.author?.id === userId` + `v05?.isExplorer`). Aucun flag serveur ajouté. L'autorité reste la RPC `update_place_position`.
- **Mode carte** : réutilisation de `addPlaceMode` (mode plein écran déjà câblé dans `ExploreMap` + `MapPage`) + nouveau champ `mapPickerPurpose: 'add' | 'editPosition'` dans `mapStore`. Pas de mode parallèle.
- **RLS historique** : lecture permissive (`true`) — trace transparente, cohérent avec le rationale « anti-abus par transparence ». Écriture : RPC `SECURITY DEFINER` uniquement.
- **Tests** : TDD (vitest) sur le seul helper pur extrait (`formatTimeAgo`). SQL + UI vérifiés par `pnpm build` + checklist QA manuelle (criterion #6 de la spec).

---

## File Structure

| Fichier | Responsabilité | Action |
|---------|----------------|--------|
| `supabase/migrations/214_place_position_correction.sql` | Table historique + RPC update + extension RPC détail | Créer |
| `apps/explore-web/src/lib/dateFormat.ts` | + `formatTimeAgo(iso)` (relatif « il y a X ») | Modifier |
| `apps/explore-web/src/lib/dateFormat.test.ts` | Test unitaire de `formatTimeAgo` | Créer |
| `apps/explore-web/src/types/placeDetail.ts` | `V05Detail.lastPositionEdit` | Modifier |
| `apps/explore-web/src/stores/notificationStore.ts` | Type `place_position_edited` + `distanceKm` | Modifier |
| `apps/explore-web/src/stores/mapStore.ts` | `mapPickerPurpose` + `editPositionTarget` + setters | Modifier |
| `apps/explore-web/src/components/places/shared/MapCrosshairPicker.tsx` | Viseur plein écran partagé (crosshair + zoom + coords + GPS) | Créer |
| `apps/explore-web/src/components/places/modals/AddPlaceFlow.tsx` | Consomme le picker partagé | Modifier |
| `apps/explore-web/src/components/places/modals/EditPositionFlow.tsx` | Éditeur 3 étapes (position → adresse → confirmation) | Créer |
| `apps/explore-web/src/pages/MapPage.tsx` | Rend `EditPositionFlow` quand `purpose === 'editPosition'` | Modifier |
| `apps/explore-web/src/components/places/views/PlacePanel.tsx` | Item de menu conditionnel + inline « Position modifiée par … » | Modifier |

---

## Task 1 : Migration 214 — table, RPC update, extension détail

**Files:**
- Create: `supabase/migrations/214_place_position_correction.sql`

- [ ] **Step 1 : Écrire la migration complète**

```sql
-- 214_place_position_correction.sql
-- WHY : permettre à l'auteur OU à un visiteur (place_explorers) de corriger la
--       position d'un lieu mal placé. Édition immédiate sans plafond de distance,
--       trace en lecture seule, notification auteur + veilleur (hors éditeur).
--       Spec : docs/superpowers/specs/2026-06-05-correction-position-lieu-design.md

BEGIN;

-- 1) Table d'historique (trace lecture seule) ---------------------------------
CREATE TABLE IF NOT EXISTS public.place_position_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id      varchar     NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id       varchar     NOT NULL REFERENCES public.users(id),
  old_latitude  real        NOT NULL,
  old_longitude real        NOT NULL,
  new_latitude  real        NOT NULL,
  new_longitude real        NOT NULL,
  old_address   text,
  new_address   text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_position_history_place
  ON public.place_position_history (place_id, created_at DESC);

ALTER TABLE public.place_position_history ENABLE ROW LEVEL SECURITY;

-- Lecture transparente (trace = anti-abus). Écriture : RPC SECURITY DEFINER only.
DROP POLICY IF EXISTS place_position_history_read ON public.place_position_history;
CREATE POLICY place_position_history_read
  ON public.place_position_history FOR SELECT
  TO authenticated, anon
  USING (true);

-- 2) RPC update_place_position ------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_place_position(
  p_user_id   text,
  p_place_id  text,
  p_latitude  real,
  p_longitude real,
  p_address   text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_author_id   text;
  v_old_lat     real;
  v_old_lng     real;
  v_old_address text;
  v_place_title text;
  v_is_eligible boolean;
  v_guardian_id text;
  v_editor_name text;
  v_distance_km numeric;
BEGIN
  SELECT author_id, latitude, longitude, address, title
    INTO v_author_id, v_old_lat, v_old_lng, v_old_address, v_place_title
    FROM public.places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  -- Éligibilité serveur : auteur OU visiteur présent dans place_explorers.
  v_is_eligible := (v_author_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.place_explorers
               WHERE place_id = p_place_id AND user_id = p_user_id);
  IF NOT v_is_eligible THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Trace (ancien + nouveau).
  INSERT INTO public.place_position_history
    (place_id, user_id, old_latitude, old_longitude,
     new_latitude, new_longitude, old_address, new_address)
  VALUES
    (p_place_id, p_user_id, v_old_lat, v_old_lng,
     p_latitude, p_longitude, v_old_address, p_address);

  -- Mise à jour immédiate, pour tous les joueurs.
  UPDATE public.places
     SET latitude = p_latitude, longitude = p_longitude,
         address = p_address, updated_at = NOW()
   WHERE id = p_place_id;

  -- Notifications : auteur + veilleur, en excluant l'éditeur.
  v_guardian_id := public.get_place_guardian(p_place_id);
  v_distance_km := public.haversine_km(v_old_lat, v_old_lng, p_latitude, p_longitude);
  SELECT first_name INTO v_editor_name FROM public.users WHERE id = p_user_id;

  IF v_author_id IS NOT NULL AND v_author_id <> p_user_id THEN
    PERFORM public.notify(v_author_id, 'place_position_edited', jsonb_build_object(
      'actorName', v_editor_name, 'actorId', p_user_id,
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'distanceKm', ROUND(v_distance_km, 2)));
  END IF;

  IF v_guardian_id IS NOT NULL
     AND v_guardian_id <> p_user_id
     AND v_guardian_id <> COALESCE(v_author_id, '') THEN
    PERFORM public.notify(v_guardian_id, 'place_position_edited', jsonb_build_object(
      'actorName', v_editor_name, 'actorId', p_user_id,
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'distanceKm', ROUND(v_distance_km, 2)));
  END IF;

  -- Trace globale.
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES ('place_position_edited', p_user_id, p_place_id, jsonb_build_object(
    'distanceKm', ROUND(v_distance_km, 2), 'editorName', v_editor_name));

  RETURN json_build_object('success', true,
    'latitude', p_latitude, 'longitude', p_longitude, 'address', p_address);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_place_position(text, text, real, real, text)
  TO authenticated, service_role;

-- 3) Extension de get_place_detail_v05 : + lastPositionEdit -------------------
-- Recopie intégrale de la def 199 + un bloc v_last_position_edit additif.
CREATE OR REPLACE FUNCTION public.get_place_detail_v05(
  p_place_id text,
  p_user_id  text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_contributions JSON;
  v_explorers JSON;
  v_avg_rating NUMERIC;
  v_rating_count INT;
  v_user_rating INT;
  v_is_wishlisted BOOLEAN := FALSE;
  v_is_explorer BOOLEAN := FALSE;
  v_guardian RECORD;
  v_description JSON;
  v_last_position_edit JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', pc.id, 'userId', pc.user_id, 'factionId', pc.faction_id,
      'type', pc.type, 'title', pc.title, 'content', pc.content,
      'imageUrl', pc.image_url, 'images', COALESCE(pc.images, '[]'::jsonb),
      'rating', pr.rating, 'votesUp', pc.votes_up, 'votesDown', pc.votes_down,
      'createdAt', pc.created_at, 'userName', u.first_name, 'userAvatar', u.avatar_url,
      'parentId', pc.parent_id,
      'likedByMe', CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS(
        SELECT 1 FROM contribution_votes cv WHERE cv.contribution_id = pc.id AND cv.user_id = p_user_id AND cv.vote = 1) END
    ) ORDER BY pc.votes_up DESC, pc.created_at ASC
  ) INTO v_contributions
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  LEFT JOIN place_ratings pr ON pr.place_id = pc.place_id AND pr.user_id = pc.user_id
  WHERE pc.place_id = p_place_id;

  SELECT json_agg(
    json_build_object(
      'userId', pe.user_id, 'visitedAt', pe.visited_at,
      'userName', u.first_name, 'userAvatar', u.avatar_url, 'factionId', u.faction_id
    ) ORDER BY pe.visited_at ASC
  ) INTO v_explorers
  FROM place_explorers pe
  JOIN users u ON u.id = pe.user_id
  WHERE pe.place_id = p_place_id;

  SELECT AVG(rating)::NUMERIC(2,1), COUNT(*) INTO v_avg_rating, v_rating_count
  FROM place_ratings WHERE place_id = p_place_id;

  SELECT pc.user_id, u.first_name AS name, u.avatar_url, u.faction_id,
    SUM(pc.votes_up) AS total_votes
  INTO v_guardian
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id
  GROUP BY pc.user_id, u.first_name, u.avatar_url, u.faction_id
  ORDER BY total_votes DESC
  LIMIT 1;

  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_wishlisted;
    SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_explorer;
    SELECT rating INTO v_user_rating FROM place_ratings WHERE place_id = p_place_id AND user_id = p_user_id;
  END IF;

  SELECT json_build_object(
    'id', d.id, 'content', d.content, 'updatedAt', d.updated_at,
    'editedBy', d.user_id, 'editorName', u.first_name, 'editorAvatar', u.avatar_url,
    'votesUp', d.votes_up,
    'revisionCount', (SELECT count(*) FROM place_description_revisions r WHERE r.place_id = p_place_id),
    'likedByMe', CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS(
      SELECT 1 FROM contribution_votes cv WHERE cv.contribution_id = d.id AND cv.user_id = p_user_id AND cv.vote = 1) END,
    'contributors', (
      SELECT COALESCE(json_agg(
        json_build_object('userId', c.uid, 'name', c.name, 'avatar', c.avatar)
        ORDER BY c.first_at ASC
      ), '[]'::json)
      FROM (
        SELECT r.edited_by AS uid, u2.first_name AS name, u2.avatar_url AS avatar, MIN(r.created_at) AS first_at
        FROM place_description_revisions r
        JOIN users u2 ON u2.id = r.edited_by
        WHERE r.place_id = p_place_id
        GROUP BY r.edited_by, u2.first_name, u2.avatar_url
      ) c
    )
  ) INTO v_description
  FROM place_contributions d JOIN users u ON u.id = d.user_id
  WHERE d.place_id = p_place_id AND d.type = 'description';

  -- NEW : dernière correction de position (pour l'inline "Position modifiée par …").
  SELECT json_build_object(
    'editorName', u.first_name,
    'editorId', h.user_id,
    'createdAt', h.created_at,
    'distanceKm', ROUND(public.haversine_km(h.old_latitude, h.old_longitude, h.new_latitude, h.new_longitude), 2)
  ) INTO v_last_position_edit
  FROM place_position_history h
  JOIN users u ON u.id = h.user_id
  WHERE h.place_id = p_place_id
  ORDER BY h.created_at DESC
  LIMIT 1;

  RETURN json_build_object(
    'influence', '[]'::json,
    'dominantFaction', NULL,
    'description', v_description,
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
    ELSE NULL END,
    'lastPositionEdit', v_last_position_edit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(text, text)
  TO authenticated, anon, service_role;

COMMIT;
```

- [ ] **Step 2 : Vérifier la syntaxe SQL (dry-run local si dispo, sinon relecture)**

Relire : la fonction `haversine_km` accepte bien `(real, real, real, real)` (cf. usages baseline) ; `get_place_guardian(text)→text` ; `users.first_name` existe ; colonne `places.address` existe (écrite par `create_place`). Aucun `ROUND(numeric, int)` sur un `real` non casté — `haversine_km` retourne `numeric`/`double precision`, `ROUND(x, 2)` OK.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/214_place_position_correction.sql
git commit -m "feat(places): migration 214 — historique + RPC update_place_position + lastPositionEdit"
```

> ⚠️ Le post-commit hook lance `scripts/graphify-sql.py` (commit touche `supabase/migrations/`). Laisser tourner.

---

## Task 2 : Helper `formatTimeAgo` (TDD)

**Files:**
- Modify: `apps/explore-web/src/lib/dateFormat.ts`
- Test: `apps/explore-web/src/lib/dateFormat.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/explore-web/src/lib/dateFormat.test.ts
import { describe, it, expect } from 'vitest'
import { formatTimeAgo } from './dateFormat'

describe('formatTimeAgo', () => {
  const now = new Date('2026-06-05T12:00:00Z').getTime()
  it('renvoie "à l\'instant" pour < 60 s', () => {
    expect(formatTimeAgo('2026-06-05T11:59:30Z', now)).toBe("à l'instant")
  })
  it('renvoie les minutes', () => {
    expect(formatTimeAgo('2026-06-05T11:45:00Z', now)).toBe('il y a 15 min')
  })
  it('renvoie les heures', () => {
    expect(formatTimeAgo('2026-06-05T09:00:00Z', now)).toBe('il y a 3 h')
  })
  it('renvoie les jours', () => {
    expect(formatTimeAgo('2026-06-03T12:00:00Z', now)).toBe('il y a 2 j')
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `cd apps/explore-web && pnpm vitest run src/lib/dateFormat.test.ts`
Expected: FAIL — `formatTimeAgo is not a function`.

- [ ] **Step 3 : Implémenter le helper**

Ajouter à la fin de `apps/explore-web/src/lib/dateFormat.ts` :

```ts
/**
 * Formatage relatif court (« il y a 15 min », « il y a 3 h », « il y a 2 j »).
 * `nowMs` injectable pour les tests ; défaut = Date.now().
 */
export function formatTimeAgo(iso: string, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000))
  if (diffSec < 60) return "à l'instant"
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} j`
}
```

- [ ] **Step 4 : Relancer le test, vérifier le succès**

Run: `cd apps/explore-web && pnpm vitest run src/lib/dateFormat.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/lib/dateFormat.ts apps/explore-web/src/lib/dateFormat.test.ts
git commit -m "feat(lib): formatTimeAgo (relatif court) + test"
```

---

## Task 3 : Types front (détail + notifications)

**Files:**
- Modify: `apps/explore-web/src/types/placeDetail.ts`
- Modify: `apps/explore-web/src/stores/notificationStore.ts`

- [ ] **Step 1 : Étendre `V05Detail`**

Dans `apps/explore-web/src/types/placeDetail.ts`, ajouter le champ à l'interface `V05Detail` (après `description`) :

```ts
  description: V05Description | null
  /** Dernière correction de position (null si jamais corrigé) */
  lastPositionEdit: {
    editorName: string | null
    editorId: string
    createdAt: string
    distanceKm: number
  } | null
```

- [ ] **Step 2 : Étendre le type de notification**

Dans `apps/explore-web/src/stores/notificationStore.ts`, ajouter le membre à l'union `type` (après le bloc V0.9 carnet, l.23) :

```ts
    | 'description_edited' | 'new_photo'
    // V0.x — Correction de position de lieu
    | 'place_position_edited'
```

Puis ajouter dans l'objet `data` (après `viewCount?`, vers l.33) le champ distance :

```ts
    distanceKm?: number
```

- [ ] **Step 3 : Vérifier la compilation des types**

Run: `cd apps/explore-web && pnpm exec tsc --noEmit`
Expected: aucune erreur introduite par ces deux fichiers.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/types/placeDetail.ts apps/explore-web/src/stores/notificationStore.ts
git commit -m "feat(types): lastPositionEdit + notif place_position_edited"
```

---

## Task 4 : `mapStore` — discriminateur de picker + cible d'édition

**Files:**
- Modify: `apps/explore-web/src/stores/mapStore.ts`

- [ ] **Step 1 : Ajouter le type de cible (avant l'interface du store)**

Dans `apps/explore-web/src/stores/mapStore.ts`, près des autres types exportés du store :

```ts
export type MapPickerPurpose = 'add' | 'editPosition'

export interface EditPositionTarget {
  placeId: string
  lat: number
  lng: number
  address: string
}
```

- [ ] **Step 2 : Déclarer les champs dans l'interface du store**

À côté de `addPlaceMode: boolean` (l.74) dans l'interface :

```ts
  mapPickerPurpose: MapPickerPurpose
  setMapPickerPurpose: (p: MapPickerPurpose) => void
  editPositionTarget: EditPositionTarget | null
  setEditPositionTarget: (t: EditPositionTarget | null) => void
```

- [ ] **Step 3 : Initialiser dans l'implémentation du store**

À côté de `addPlaceMode: false,` (l.145) :

```ts
  mapPickerPurpose: 'add',
  setMapPickerPurpose: (p) => set({ mapPickerPurpose: p }),
  editPositionTarget: null,
  setEditPositionTarget: (t) => set({ editPositionTarget: t }),
```

- [ ] **Step 4 : Vérifier la compilation**

Run: `cd apps/explore-web && pnpm exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/stores/mapStore.ts
git commit -m "feat(mapStore): mapPickerPurpose + editPositionTarget"
```

---

## Task 5 : `MapCrosshairPicker` (viseur partagé extrait d'`AddPlaceFlow`)

**Files:**
- Create: `apps/explore-web/src/components/places/shared/MapCrosshairPicker.tsx`

> Le picker réutilise les classes CSS existantes `add-place-*` (déjà chargées globalement via `AddPlaceFlow.css`). Pas de nouveau CSS.

- [ ] **Step 1 : Créer le composant**

```tsx
// apps/explore-web/src/components/places/shared/MapCrosshairPicker.tsx
import { useState, useEffect, useRef } from 'react'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'

interface Props {
  title: string
  confirmLabel: string
  /** Coords confirmées (centre du viseur) au clic sur le bouton de confirmation */
  onConfirm: (coords: { lat: number; lng: number }) => void
  onCancel: () => void
}

/**
 * Viseur plein écran partagé : crosshair central fixe, la coordonnée vient du
 * centre de carte via mapStore.pendingNewPlaceCoords (alimenté par ExploreMap en
 * mode addPlaceMode). Extrait de l'étape "location" d'AddPlaceFlow (sprint
 * Purification — sous-composant partagé), consommé par AddPlaceFlow et
 * EditPositionFlow.
 */
export function MapCrosshairPicker({ title, confirmLabel, onConfirm, onCancel }: Props) {
  const coords = useMapStore(s => s.pendingNewPlaceCoords)
  const userPosition = usePlayerStore(s => s.userPosition)

  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [coordsFocused, setCoordsFocused] = useState(false)

  // Sync inputs depuis le centre de carte (sauf pendant l'édition manuelle).
  useEffect(() => {
    if (coords && !coordsFocused) {
      setLatInput(coords.lat.toFixed(7))
      setLngInput(coords.lng.toFixed(7))
    }
  }, [coords, coordsFocused])

  function handleCoordsSubmit() {
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      useMapStore.getState().requestFlyTo({ lng, lat })
      setCoordsFocused(false)
    }
  }

  function handleGPS() {
    if (userPosition) {
      useMapStore.getState().requestFlyTo({ lng: userPosition.lng, lat: userPosition.lat })
    }
  }

  const blurRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className="add-place-top-bar">
        <button className="add-place-back-btn" onClick={onCancel}>
          &#8592; Retour
        </button>
        <span className="add-place-step-title">{title}</span>
        <button
          className="add-place-next-btn"
          onClick={() => coords && onConfirm({ lat: coords.lat, lng: coords.lng })}
          disabled={!coords}
        >
          {confirmLabel}
        </button>
      </div>

      <div className="add-place-crosshair">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="#ffffff" strokeWidth="6" strokeDasharray="4 3" opacity="0.6" />
          <circle cx="24" cy="24" r="7" fill="#ffffff" opacity="0.6" />
          <line x1="24" y1="0" x2="24" y2="16" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <line x1="24" y1="32" x2="24" y2="48" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <line x1="0" y1="24" x2="16" y2="24" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <line x1="32" y1="24" x2="48" y2="24" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <circle cx="24" cy="24" r="20" stroke="#4A3728" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
          <circle cx="24" cy="24" r="4" fill="#4A3728" />
          <line x1="24" y1="0" x2="24" y2="16" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
          <line x1="24" y1="32" x2="24" y2="48" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
          <line x1="0" y1="24" x2="16" y2="24" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
          <line x1="32" y1="24" x2="48" y2="24" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
        </svg>
      </div>

      <div className="add-place-zoom-btns">
        <button className="add-place-zoom-btn" onClick={() => useMapStore.getState().requestZoom('in')}>+</button>
        <button className="add-place-zoom-btn" onClick={() => useMapStore.getState().requestZoom('out')}>&minus;</button>
      </div>

      <div className="add-place-bottom-bar">
        <button className="add-place-gps-btn" onClick={handleGPS} disabled={!userPosition}>
          📍 Ma position
        </button>
        <div className="add-place-coords-inputs">
          <label className="add-place-coord-label">Lat</label>
          <input
            className="add-place-coord-input"
            type="text"
            inputMode="decimal"
            value={latInput}
            onChange={e => setLatInput(e.target.value)}
            onFocus={() => setCoordsFocused(true)}
            onBlur={() => { setCoordsFocused(false); handleCoordsSubmit() }}
            onKeyDown={e => { if (e.key === 'Enter') { handleCoordsSubmit(); (e.target as HTMLInputElement).blur() } }}
            placeholder="43.7000"
          />
          <label className="add-place-coord-label">Lng</label>
          <input
            ref={blurRef}
            className="add-place-coord-input"
            type="text"
            inputMode="decimal"
            value={lngInput}
            onChange={e => setLngInput(e.target.value)}
            onFocus={() => setCoordsFocused(true)}
            onBlur={() => { setCoordsFocused(false); handleCoordsSubmit() }}
            onKeyDown={e => { if (e.key === 'Enter') { handleCoordsSubmit(); (e.target as HTMLInputElement).blur() } }}
            placeholder="7.2600"
          />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd apps/explore-web && pnpm exec tsc --noEmit`
Expected: aucune erreur (le composant n'est pas encore consommé — c'est attendu, tsc ne se plaint pas d'un export inutilisé).

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/components/places/shared/MapCrosshairPicker.tsx
git commit -m "refactor(places): MapCrosshairPicker partagé (extrait d'AddPlaceFlow)"
```

---

## Task 6 : `AddPlaceFlow` consomme le picker partagé

**Files:**
- Modify: `apps/explore-web/src/components/places/modals/AddPlaceFlow.tsx`

- [ ] **Step 1 : Importer le picker**

Après l'import d'`EraSelector` (l.10) :

```ts
import { MapCrosshairPicker } from '../shared/MapCrosshairPicker'
```

- [ ] **Step 2 : Adapter `handleConfirmLocation` pour recevoir les coords**

Remplacer la signature et le garde de `handleConfirmLocation` (l.138) :

```ts
  function handleConfirmLocation(confirmed: { lat: number; lng: number }) {
    setConfirmedCoords({ lng: confirmed.lng, lat: confirmed.lat })
    setStep('form')
    // Reverse geocoding — toujours mettre à jour l'adresse
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${confirmed.lat}&lon=${confirmed.lng}&format=json&accept-language=fr`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (data?.display_name) setAddress(data.display_name)
      })
      .catch(err => console.warn('[AddPlaceFlow] reverse-geocoding failed', err))
  }
```

- [ ] **Step 3 : Remplacer le bloc STEP location par le picker**

Remplacer tout le bloc `if (step === 'location') { return ( <> ...top-bar...crosshair...zoom...bottom-bar... </> ) }` (l.431-510) par :

```tsx
  // ===== STEP 1 : Location =====
  if (step === 'location') {
    return (
      <MapCrosshairPicker
        title="Placer un lieu"
        confirmLabel="Placer ici"
        onConfirm={handleConfirmLocation}
        onCancel={handleClose}
      />
    )
  }
```

- [ ] **Step 4 : Supprimer le code mort devenu inutilisé**

Supprimer de `AddPlaceFlow` les états/handlers désormais portés par le picker : `latInput`, `setLatInput`, `lngInput`, `setLngInput`, `coordsFocused`, `setCoordsFocused` (l.63-65), l'`useEffect` de sync inputs (l.102-107), `handleGPS` (l.123-127), `handleCoordsSubmit` (l.129-136). Conserver l'`useEffect` initial fly-to (l.116-121) et `handleClose`.

> Règle inviolable : pas de code mort. Vérifier qu'aucune autre référence ne subsiste (`grep -n "latInput\|coordsFocused\|handleCoordsSubmit\|handleGPS" AddPlaceFlow.tsx` → 0 résultat).

- [ ] **Step 5 : Build complet**

Run: `cd apps/explore-web && pnpm build`
Expected: `tsc && vite build` réussit, aucune erreur TS, aucun `console.log` ajouté.

- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/components/places/modals/AddPlaceFlow.tsx
git commit -m "refactor(places): AddPlaceFlow consomme MapCrosshairPicker"
```

---

## Task 7 : `EditPositionFlow` (éditeur 3 étapes)

**Files:**
- Create: `apps/explore-web/src/components/places/modals/EditPositionFlow.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// apps/explore-web/src/components/places/modals/EditPositionFlow.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useToastStore } from '../../../stores/toastStore'
import { MapCrosshairPicker } from '../shared/MapCrosshairPicker'
import '../modals/AddPlaceFlow.css'

type Step = 'position' | 'address' | 'submitting'

/**
 * Éditeur de position d'un lieu existant. Réutilise le mode plein écran
 * addPlaceMode (mapPickerPurpose === 'editPosition') et le viseur partagé.
 * Pré-centré sur la position actuelle du lieu (editPositionTarget). Édition
 * immédiate via RPC update_place_position (autorité serveur sur l'éligibilité).
 */
export function EditPositionFlow() {
  const target = useMapStore(s => s.editPositionTarget)
  const userId = usePlayerStore(s => s.userId)

  const [step, setStep] = useState<Step>('position')
  const [confirmedCoords, setConfirmedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const flyDoneRef = useRef(false)

  // Pré-centrage sur la position actuelle (une seule fois).
  useEffect(() => {
    if (flyDoneRef.current || !target) return
    flyDoneRef.current = true
    useMapStore.getState().setPendingNewPlaceCoords({ lng: target.lng, lat: target.lat })
    useMapStore.getState().requestFlyTo({ lng: target.lng, lat: target.lat })
  }, [target])

  function closeFlow() {
    const m = useMapStore.getState()
    m.setAddPlaceMode(false)
    m.setMapPickerPurpose('add')
    m.setEditPositionTarget(null)
    m.setPendingNewPlaceCoords(null)
  }

  function handlePositionConfirm(coords: { lat: number; lng: number }) {
    setConfirmedCoords(coords)
    setStep('address')
    // Reverse-geocoding (comme à la création) — proposition éditable.
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&accept-language=fr`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (data?.display_name) setAddress(data.display_name) })
      .catch(err => console.warn('[EditPositionFlow] reverse-geocoding failed', err))
  }

  async function handleSubmit() {
    if (!userId || !target || !confirmedCoords) return
    const ok = window.confirm(
      'Confirmez-vous que cette position est exacte ? Elle remplace l\'actuelle pour tous les joueurs.'
    )
    if (!ok) return
    setStep('submitting')
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('update_place_position', {
        p_user_id: userId,
        p_place_id: target.placeId,
        p_latitude: confirmedCoords.lat,
        p_longitude: confirmedCoords.lng,
        p_address: address.trim(),
      })
      if (rpcError) { setError(rpcError.message); setStep('address'); return }
      if (data?.error === 'not_eligible') {
        setError('Tu n\'es pas autorisé à corriger ce lieu (auteur ou visiteur uniquement).')
        setStep('address'); return
      }
      if (data?.error) { setError(data.error); setStep('address'); return }

      // Succès : la carte se rafraîchit + recentrage sur le nouveau point.
      const m = useMapStore.getState()
      closeFlow()
      m.incrementPlacesRefreshKey()
      m.requestFlyTo({ lng: confirmedCoords.lng, lat: confirmedCoords.lat, placeId: target.placeId })
      useToastStore.getState().addToast({
        type: 'new_place',
        message: '📍 Position corrigée. Le marqueur a été déplacé.',
        timestamp: Date.now(),
        placeId: target.placeId,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStep('address')
    }
  }

  if (!target) return null

  // ===== STEP 1 : Position =====
  if (step === 'position') {
    return (
      <MapCrosshairPicker
        title="Corriger la position"
        confirmLabel="Valider"
        onConfirm={handlePositionConfirm}
        onCancel={closeFlow}
      />
    )
  }

  // ===== STEP 2 : Adresse + confirmation =====
  if (step === 'address') {
    return (
      <div className="add-place-form">
        <div className="add-place-form-header">
          <button className="add-place-back-btn" onClick={() => setStep('position')}>
            &#8592; Retour
          </button>
          <span className="add-place-step-title">Nouvelle adresse</span>
          <div style={{ width: 80 }} />
        </div>
        <div className="add-place-form-body">
          {error && <div className="add-place-error">{error}</div>}

          {confirmedCoords && (
            <>
              <div className="add-place-coords-display">
                Ancienne : {target.lat.toFixed(7)}, {target.lng.toFixed(7)}
              </div>
              <div className="add-place-coords-display">
                Nouvelle : {confirmedCoords.lat.toFixed(7)}, {confirmedCoords.lng.toFixed(7)}
              </div>
            </>
          )}

          <label className="add-place-label">Adresse</label>
          <input
            className="add-place-input"
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Adresse correspondant à la nouvelle position"
          />
        </div>
        <div className="add-place-form-footer">
          <button className="add-place-cancel-btn" onClick={closeFlow}>Annuler</button>
          <button className="add-place-submit-btn" onClick={handleSubmit}>
            Enregistrer la position
          </button>
        </div>
      </div>
    )
  }

  // ===== STEP 3 : Submitting =====
  return (
    <div className="add-place-form">
      <div className="add-place-loading">
        <div className="add-place-spinner" />
        <span>Mise à jour de la position…</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd apps/explore-web && pnpm exec tsc --noEmit`
Expected: aucune erreur. (Si `incrementPlacesRefreshKey` n'existe pas sous ce nom, vérifier dans `mapStore` — il est utilisé par `AddPlaceFlow` l.375, donc présent.)

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/components/places/modals/EditPositionFlow.tsx
git commit -m "feat(places): EditPositionFlow (correction de position 3 étapes)"
```

---

## Task 8 : Montage dans `MapPage`

**Files:**
- Modify: `apps/explore-web/src/pages/MapPage.tsx:478`

- [ ] **Step 1 : Importer `EditPositionFlow`**

Près de l'import d'`AddPlaceFlow` dans `MapPage.tsx` :

```ts
import { EditPositionFlow } from '../components/places/modals/EditPositionFlow'
```

- [ ] **Step 2 : Lire `mapPickerPurpose` et brancher le rendu conditionnel**

Ajouter le sélecteur près de `const addPlaceMode = useMapStore(s => s.addPlaceMode)` (l.123) :

```ts
  const mapPickerPurpose = useMapStore(s => s.mapPickerPurpose)
```

Remplacer la ligne `{addPlaceMode && <AddPlaceFlow />}` (l.478) par :

```tsx
      {addPlaceMode && (mapPickerPurpose === 'editPosition' ? <EditPositionFlow /> : <AddPlaceFlow />)}
```

> Tous les autres gardes `!addPlaceMode` restent inchangés : on veut l'UI carte masquée aussi en mode édition (même expérience plein écran que l'ajout).

- [ ] **Step 3 : Build**

Run: `cd apps/explore-web && pnpm build`
Expected: succès.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(places): monte EditPositionFlow selon mapPickerPurpose"
```

---

## Task 9 : `PlacePanel` — item de menu + inline « Position modifiée par … »

**Files:**
- Modify: `apps/explore-web/src/components/places/views/PlacePanel.tsx`

- [ ] **Step 1 : Importer le helper relatif**

Vérifier/ajouter l'import en tête de `PlacePanel.tsx` :

```ts
import { formatTimeAgo } from '../../../lib/dateFormat'
```

- [ ] **Step 2 : Ajouter l'item de menu conditionnel (après le bouton Waze, l.757)**

Juste après la fermeture du `<button>` « 🚗 Waze » (l.757) et avant la fermeture du `<div className="place-options-menu">` :

```tsx
                      {(isAuthor || v05?.isExplorer === true) && (
                        <button
                          className="place-options-item"
                          onClick={() => {
                            setShowAddressMenu(false)
                            const m = useMapStore.getState()
                            m.setEditPositionTarget({
                              placeId: place.id,
                              lat: place.location.latitude,
                              lng: place.location.longitude,
                              address: place.address ?? '',
                            })
                            m.setMapPickerPurpose('editPosition')
                            m.setAddPlaceMode(true)
                          }}
                        >
                          ✏️ Corriger la position
                        </button>
                      )}
```

> `isAuthor` est défini l.433 ; `v05` (retour de `get_place_detail_v05`) l.407. Les deux sont dans la portée du render principal où vit ce menu. Le pré-centrage de la carte est géré par `EditPositionFlow` (pas besoin de `requestFlyTo` ici).

- [ ] **Step 3 : Ajouter l'inline « Position modifiée par … » sous l'adresse**

Juste après la fermeture du bloc adresse `{place.address && ( … )}` (l.763), ajouter :

```tsx
          {v05?.lastPositionEdit && (
            <p className="place-position-edited info-meta">
              📍 Position modifiée par {v05.lastPositionEdit.editorName ?? 'un joueur'}
              {' · '}{formatTimeAgo(v05.lastPositionEdit.createdAt)}
            </p>
          )}
```

> Réutilise la classe `info-meta` (pattern de `PlaceInfos.tsx`). Pas de nouveau CSS requis ; `place-position-edited` est une classe de portée optionnelle (aucun style obligatoire).

- [ ] **Step 4 : Build complet**

Run: `cd apps/explore-web && pnpm build`
Expected: succès, TS strict OK, pas de `any`, pas de `console.log`.

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/places/views/PlacePanel.tsx
git commit -m "feat(places): item 'Corriger la position' + inline dernière correction"
```

---

## Task 10 : Application de la migration + QA manuelle

**Files:** aucun (vérification).

- [ ] **Step 1 : Appliquer la migration sur Supabase**

Via Supabase MCP (`apply_migration`, nom `214_place_position_correction`) ou CLI selon le workflow `docs/db/migrations-workflow.md`. Vérifier ensuite avec `list_migrations` que 214 est présente.

- [ ] **Step 2 : Régénérer les types si le projet le fait** (optionnel selon convention)

- [ ] **Step 3 : QA manuelle — dérouler les critères d'acceptation de la spec**

| # | Critère | Vérif |
|---|---------|-------|
| 1 | Non-éligible : item masqué + RPC directe → `not_eligible` | Compte sans visite ni auteur ; appel `update_place_position` manuel → `{error:'not_eligible'}` |
| 2 | Visiteur corrige : marqueur bouge pour tous, adresse MAJ, `updated_at` rafraîchi | Déplacer le pin, valider ; recharger sur un 2e compte |
| 3 | Ligne d'historique créée (ancien + nouveau) | `SELECT * FROM place_position_history ORDER BY created_at DESC LIMIT 1` |
| 4 | Auteur + veilleur notifiés `place_position_edited` (sauf éditeur) | Vérifier `notifications` des deux ; l'éditeur n'en reçoit pas |
| 5 | Fiche affiche « Position modifiée par {nom} · il y a {X} » | Rouvrir la fiche après correction |
| 6 | `pnpm build` passe (TS strict, pas de `any`, pas de `console.log`) | `cd apps/explore-web && pnpm build` |

- [ ] **Step 4 : Vérifier la suite vitest**

Run: `cd apps/explore-web && pnpm vitest run`
Expected: tous les tests passent (dont `dateFormat.test.ts`).

- [ ] **Step 5 : Bump version + commit + push (préférence Uriel)**

Bumper `APP_VERSION` (patch) si applicable, puis push du lot complet.

```bash
git push
```

---

## Self-Review (couverture spec)

- **Éligibilité (auteur OU visiteur)** → Task 1 (RPC, autorité) + Task 9 Step 2 (affichage). ✓
- **Édition immédiate sans plafond** → Task 1 RPC (UPDATE direct). ✓
- **Trace lecture seule, pas de restore** → Task 1 table + RLS read-only client. ✓
- **Notif auteur + veilleur (hors éditeur)** → Task 1 RPC blocs `notify`. ✓
- **Adresse couplée (re-géocodage + éditable)** → Task 7 Step `address`. ✓
- **Aucun point** → aucune logique de récompense ajoutée. ✓
- **window.confirm avant envoi** → Task 7 `handleSubmit`. ✓
- **Point d'entrée = item du menu existant, conditionnel** → Task 9 Step 2. ✓
- **Éditeur réutilise le viseur d'AddPlaceFlow, pré-centré** → Task 5 + 7. ✓
- **Refactor MapCrosshairPicker partagé** → Task 5 + 6. ✓
- **RPC `update_place_position` (signature exacte spec)** → Task 1. ✓
- **Table `place_position_history` (schéma spec)** → Task 1. ✓
- **Type notif `place_position_edited` + payload (nom, titre, distance haversine)** → Task 3 + Task 1. ✓
- **`activity_log`** → Task 1 RPC. ✓
- **Inline « Position modifiée par … »** → Task 9 Step 3 + extension `get_place_detail_v05` Task 1. ✓
- **Effets de bord assumés** (place_explorers conservé, fog/territoires recalculés) → aucun code, comportement naturel. ✓
- **Hors-scope V1** (pas de modale historique, pas de revert, pas de rate-limit) → respecté. ✓
- **Critères d'acceptation** → Task 10 checklist. ✓

> Écart documenté vs spec : la spec proposait d'exposer un flag `can_edit_position` serveur ; le reality-check montre que le front a déjà tous les signaux (`isAuthor` + `v05.isExplorer`), donc on ne touche pas la RPC pour l'éligibilité — seulement pour `lastPositionEdit`. L'autorité reste 100 % serveur dans `update_place_position`.
