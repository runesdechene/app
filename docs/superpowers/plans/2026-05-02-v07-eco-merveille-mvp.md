# V0.7 MVP ECO Merveille — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer 3 features pour ECO Merveille (~12 mai 2026) : toggle "Brouiller mes pistes" (privacy GPS 50km terre uniquement), note partagée sur le profil, avatars offline persistants en gris (TTL 24h).

**Architecture:** Supabase (PostGIS + Realtime Presence existant) + React/Zustand frontend. Migrations SQL numérotées à partir de 054. Position floutée fixée au lancement de session (pas de recalcul à chaque update). Persistance `last_seen_*` via UPDATE périodique sur `users` complétant la couche Realtime éphémère.

**Tech Stack:** PostgreSQL 15 (Supabase) + PostGIS, Supabase Realtime/Presence, TypeScript/React 18, Zustand 7, MapLibre GL JS, Vite 5.

**Spec source:** [`2026-05-01-v07-eco-merveille-mvp-design.md`](../specs/2026-05-01-v07-eco-merveille-mvp-design.md)

---

## File Structure

### Migrations SQL (créées, pas modifiées)

```
supabase/migrations/
├── 054_v07_mvp_postgis_landmasses.sql        # PostGIS extension + dataset landmasses + is_on_land()
├── 055_v07_mvp_brouiller_pistes_column.sql   # users.brouiller_pistes column (default true)
├── 056_v07_mvp_blur_position_rpc.sql         # RPC blur_position_on_land(lat, lng) → randomized point on land
├── 057_v07_mvp_profile_note_columns.sql      # users.profile_note + profile_note_updated_at
├── 058_v07_mvp_set_profile_note_rpc.sql      # RPC set_profile_note(p_note)
├── 059_v07_mvp_last_seen_columns.sql         # users.last_seen_at + last_seen_lat + last_seen_lng
├── 060_v07_mvp_update_last_seen_rpc.sql      # RPC update_last_seen(p_lat, p_lng) (called periodically)
└── 061_v07_mvp_get_offline_players_rpc.sql   # RPC get_offline_players() returns offline users seen <24h ago
```

### Dataset external

```
supabase/seed/landmasses/
└── ne_50m_land.geojson  # Natural Earth 1:50m land polygon, ~3 MB, gratuit
```
(Téléchargé une fois, importé via la migration 054.)

### Frontend nouveaux fichiers

```
apps/explore-web/src/components/settings/
└── BrouillerPistesToggle.tsx                 # Toggle on/off in user settings

apps/explore-web/src/components/profile/
└── ProfileNoteEditor.tsx                      # Inline editor for profile_note (200 char limit)

apps/explore-web/src/lib/
└── blurredPosition.ts                         # Helper: cache blurred position for session (fetched once at login)
```

### Frontend fichiers modifiés

```
apps/explore-web/src/stores/playersStore.ts   # Add isOffline + lastSeen + profile_note to OnlinePlayer
apps/explore-web/src/components/map/OnlinePlayerMarkers.tsx  # Render offline avatars in grey
apps/explore-web/src/components/map/PlayerProfileModal.tsx  # Add ProfileNoteEditor + "Vu il y a X" if offline
apps/explore-web/src/hooks/usePlayer.ts        # On login: fetch blur preference, compute blurred position once
apps/explore-web/src/lib/supabase.ts           # (probable: add typed RPC signatures, à confirmer)
```

### Tests

```
supabase/tests/
├── 054_landmasses_test.sql                   # Verify is_on_land() returns correct values
├── 056_blur_position_test.sql                # Verify blur_position_on_land never returns ocean
└── 060_last_seen_test.sql                    # Verify update_last_seen + get_offline_players work
```

---

## Phase 0 — Préparation environnement

### Task 0.1: Vérifier l'état Supabase et créer la branche dev

**Files:**
- Read: `supabase/config.toml`
- Modify: nothing yet

- [ ] **Step 1: Lire la config Supabase et confirmer la version PostgreSQL**

```bash
cat "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/supabase/config.toml" | head -30
```
Expected: voir la `major_version` (15 ou 16). Si 15+ alors PostGIS 3.3+ disponible.

- [ ] **Step 2: Vérifier que PostGIS est disponible dans Supabase**

Connecter à la DB Supabase via le dashboard Supabase ou `pnpm dlx supabase db inspect`. Exécuter :

```sql
SELECT * FROM pg_available_extensions WHERE name = 'postgis';
```
Expected: 1 ligne avec `postgis` dispo.

- [ ] **Step 3: Créer une branche feature**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
git checkout main
git pull
git checkout -b v07-eco-merveille-mvp
```
Expected: nouvelle branche créée, basée sur main à jour.

---

## Phase 1 — Infra PostGIS + Dataset Landmasses

### Task 1.1: Télécharger le dataset Natural Earth land

**Files:**
- Create: `supabase/seed/landmasses/ne_50m_land.geojson`

- [ ] **Step 1: Créer le dossier seed et télécharger le dataset**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
mkdir -p supabase/seed/landmasses
curl -L -o supabase/seed/landmasses/ne_50m_land.geojson \
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson"
```
Expected: fichier téléchargé, ~3 MB, 1 ligne JSON valide (FeatureCollection).

- [ ] **Step 2: Valider le format**

```bash
head -c 200 supabase/seed/landmasses/ne_50m_land.geojson
```
Expected: starts with `{"type":"FeatureCollection",...`. Confirme que c'est un GeoJSON valide.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed/landmasses/ne_50m_land.geojson
git commit -m "chore(v0.7-mvp): add Natural Earth ne_50m_land seed dataset"
```

---

### Task 1.2: Migration 054 — PostGIS + landmasses table + is_on_land()

**Files:**
- Create: `supabase/migrations/054_v07_mvp_postgis_landmasses.sql`
- Create: `supabase/tests/054_landmasses_test.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/054_v07_mvp_postgis_landmasses.sql` :

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — PostGIS + dataset landmasses + is_on_land()
-- =====================================================================
-- Permet de vérifier qu'une coordonnée GPS est sur la terre ferme,
-- nécessaire pour la fonctionnalité "Brouiller mes pistes" (mig 056).
--
-- Source dataset : Natural Earth ne_50m_land (CC0, ~3 MB).
-- Précision : 1:50m, suffisant pour rejeter les océans et grandes mers.
-- =====================================================================

-- Active PostGIS si pas déjà fait
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table des polygones terrestres
CREATE TABLE IF NOT EXISTS public.landmasses (
  id      bigserial PRIMARY KEY,
  geom    geometry(MultiPolygon, 4326) NOT NULL
);

-- Index spatial pour requêtes rapides
CREATE INDEX IF NOT EXISTS landmasses_geom_idx ON public.landmasses USING GIST(geom);

-- Fonction: est-ce qu'un point GPS est sur la terre ferme ?
-- Utilisation: SELECT is_on_land(43.6, 1.4) -> true/false
CREATE OR REPLACE FUNCTION public.is_on_land(p_lat double precision, p_lng double precision)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.landmasses
    WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
  );
$$;

COMMENT ON FUNCTION public.is_on_land(double precision, double precision) IS
  'V0.7 MVP — Returns true if (lat,lng) falls on a landmass (Natural Earth ne_50m_land). False for oceans, large seas. Used by blur_position_on_land() RPC.';
```

- [ ] **Step 2: Importer le dataset GeoJSON dans la table landmasses**

Le seed doit être inclus dans la migration. Soit via un INSERT INTO ... SELECT depuis le GeoJSON parsé, soit via `ogr2ogr` en script séparé.

**Approche pragmatique** : générer un fichier `054_v07_mvp_postgis_landmasses_seed.sql` à part qui contient les `INSERT INTO landmasses (geom) VALUES (ST_GeomFromGeoJSON('...'));`.

Script de génération une seule fois, depuis le repo root :

```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('supabase/seed/landmasses/ne_50m_land.geojson', 'utf8'));
const inserts = data.features.map(f =>
  \`INSERT INTO public.landmasses (geom) VALUES (ST_Multi(ST_GeomFromGeoJSON('\${JSON.stringify(f.geometry).replace(/'/g, \"''\")}')));\`
).join('\n');
fs.writeFileSync('supabase/migrations/054_v07_mvp_postgis_landmasses_seed.sql', inserts);
"
```

Cela produit un fichier `054_v07_mvp_postgis_landmasses_seed.sql` à appliquer immédiatement après le 054. **À noter** : Supabase applique les migrations dans l'ordre alphanumérique strict, donc le seed doit s'appeler `054_*` ET être après. Mieux : intégrer les inserts directement à la fin de `054_v07_mvp_postgis_landmasses.sql`.

**Approche choisie** : ouvrir `054_v07_mvp_postgis_landmasses.sql` et y ajouter les inserts à la fin. Le fichier final fera ~3 MB de SQL.

```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('supabase/seed/landmasses/ne_50m_land.geojson', 'utf8'));
const inserts = data.features.map(f =>
  \`INSERT INTO public.landmasses (geom) VALUES (ST_Multi(ST_GeomFromGeoJSON('\${JSON.stringify(f.geometry).replace(/'/g, \"''\")}')));\`
).join('\n');
fs.appendFileSync('supabase/migrations/054_v07_mvp_postgis_landmasses.sql', '\n\n-- =====================================================================\n-- Seed data : ne_50m_land features\n-- =====================================================================\n' + inserts + '\n');
"
```

- [ ] **Step 3: Appliquer la migration sur Supabase**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase db push
```
Expected: migration `054_v07_mvp_postgis_landmasses.sql` appliquée sans erreur.

- [ ] **Step 4: Vérifier que le dataset est chargé**

Via le dashboard Supabase SQL editor :

```sql
SELECT COUNT(*) FROM public.landmasses;
-- Expected: ~1428 rows (nombre de features de ne_50m_land)

SELECT public.is_on_land(43.6, 1.4);    -- Toulouse → true
SELECT public.is_on_land(45.0, -15.0);  -- Atlantique milieu → false
SELECT public.is_on_land(35.7, 139.7);  -- Tokyo → true
SELECT public.is_on_land(0.0, -160.0);  -- Pacifique → false
```
Expected: COUNT > 1000, et les 4 résultats true/false/true/false.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/054_v07_mvp_postgis_landmasses.sql
git commit -m "feat(v0.7-mvp): mig 054 — PostGIS + landmasses table + is_on_land()"
git push
```

---

## Phase 2 — Feature 1 : Toggle "Brouiller mes pistes"

### Task 2.1: Migration 055 — colonne brouiller_pistes

**Files:**
- Create: `supabase/migrations/055_v07_mvp_brouiller_pistes_column.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/055_v07_mvp_brouiller_pistes_column.sql`:

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — Add users.brouiller_pistes
-- =====================================================================
-- Toggle on/off pour activer le brouillage GPS (50km, terre uniquement).
-- Activé par défaut (privacy-by-default) pour les nouveaux comptes
-- ET pour les comptes existants au moment de la migration.
-- =====================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS brouiller_pistes boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.brouiller_pistes IS
  'V0.7 MVP — Si true, la position GPS publique du joueur est randomisée dans 50km autour de sa position réelle, sur terre ferme uniquement. Activé par défaut. Position floutée fixée au lancement de session, pas de recalcul à chaque update GPS.';
```

- [ ] **Step 2: Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 3: Vérifier**

```sql
SELECT brouiller_pistes FROM public.users LIMIT 5;
-- Expected: tous les comptes existants ont brouiller_pistes = true
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/055_v07_mvp_brouiller_pistes_column.sql
git commit -m "feat(v0.7-mvp): mig 055 — users.brouiller_pistes (default true)"
git push
```

---

### Task 2.2: Migration 056 — RPC blur_position_on_land()

**Files:**
- Create: `supabase/migrations/056_v07_mvp_blur_position_rpc.sql`
- Create: `supabase/tests/056_blur_position_test.sql`

- [ ] **Step 1: Écrire le test SQL**

Create `supabase/tests/056_blur_position_test.sql`:

```sql
-- Test: blur_position_on_land doit retourner un point sur terre dans 50km
-- Sample 50 randomisations à partir d'un point continental (Toulouse, France)
-- Toutes doivent être sur terre.

DO $$
DECLARE
  i int;
  result record;
  ocean_count int := 0;
  far_count int := 0;
BEGIN
  FOR i IN 1..50 LOOP
    SELECT * INTO result FROM public.blur_position_on_land(43.6047, 1.4442);

    IF NOT public.is_on_land(result.blurred_lat, result.blurred_lng) THEN
      ocean_count := ocean_count + 1;
    END IF;

    -- Distance haversine simplifiée : si > 55 km c'est que la randomisation est hors zone
    IF ST_Distance(
      ST_SetSRID(ST_MakePoint(1.4442, 43.6047), 4326)::geography,
      ST_SetSRID(ST_MakePoint(result.blurred_lng, result.blurred_lat), 4326)::geography
    ) > 55000 THEN
      far_count := far_count + 1;
    END IF;
  END LOOP;

  ASSERT ocean_count = 0, format('Got %s ocean results out of 50', ocean_count);
  ASSERT far_count = 0, format('Got %s out-of-radius results out of 50', far_count);

  RAISE NOTICE 'blur_position_on_land test PASSED (50/50 on land, all within 50km)';
END;
$$;
```

- [ ] **Step 2: Exécuter le test → doit échouer (RPC pas encore créée)**

```bash
psql $SUPABASE_DB_URL -f "supabase/tests/056_blur_position_test.sql"
```
Expected: ERREUR `function blur_position_on_land does not exist`.

- [ ] **Step 3: Écrire la migration RPC**

Create `supabase/migrations/056_v07_mvp_blur_position_rpc.sql`:

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — RPC blur_position_on_land
-- =====================================================================
-- Génère une position GPS aléatoire dans un disque de 50km autour
-- d'une position d'origine, garantie sur terre ferme.
--
-- Algorithme : tirage uniforme dans le disque (sqrt pour éviter biais
-- du centre), check is_on_land(), retry max 15× sinon fallback à la
-- position originale.
--
-- Appelé une seule fois par session (au login ou toggle), pas à chaque
-- update GPS — c'est le frontend qui cache le résultat (cf. blurredPosition.ts).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.blur_position_on_land(
  p_lat double precision,
  p_lng double precision
)
RETURNS TABLE(blurred_lat double precision, blurred_lng double precision)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_radius_m constant double precision := 50000.0;  -- 50 km
  v_max_tries constant int := 15;
  v_try int := 0;
  v_r double precision;
  v_theta double precision;
  v_dx double precision;
  v_dy double precision;
  v_lat_offset double precision;
  v_lng_offset double precision;
  v_candidate_lat double precision;
  v_candidate_lng double precision;
BEGIN
  WHILE v_try < v_max_tries LOOP
    -- Tirage uniforme dans le disque : r = R*sqrt(rand), theta = 2*PI*rand
    v_r := v_radius_m * sqrt(random());
    v_theta := 2.0 * pi() * random();
    v_dx := v_r * cos(v_theta);  -- en mètres, est-ouest
    v_dy := v_r * sin(v_theta);  -- en mètres, nord-sud

    -- Conversion mètres -> degrés (approximation correcte sur 50km)
    v_lat_offset := v_dy / 111320.0;
    v_lng_offset := v_dx / (111320.0 * cos(radians(p_lat)));

    v_candidate_lat := p_lat + v_lat_offset;
    v_candidate_lng := p_lng + v_lng_offset;

    IF public.is_on_land(v_candidate_lat, v_candidate_lng) THEN
      blurred_lat := v_candidate_lat;
      blurred_lng := v_candidate_lng;
      RETURN NEXT;
      RETURN;
    END IF;

    v_try := v_try + 1;
  END LOOP;

  -- Fallback : si on n'a pas trouvé en 15 essais (île minuscule entourée d'océan),
  -- retourner la position originale. Mieux que rien.
  blurred_lat := p_lat;
  blurred_lng := p_lng;
  RETURN NEXT;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.blur_position_on_land(double precision, double precision) TO authenticated, anon;

COMMENT ON FUNCTION public.blur_position_on_land(double precision, double precision) IS
  'V0.7 MVP — Returns a random point within 50km of (lat,lng) guaranteed to be on land. Used by frontend at session start when brouiller_pistes is enabled.';
```

- [ ] **Step 4: Appliquer + ré-exécuter le test**

```bash
pnpm dlx supabase db push
psql $SUPABASE_DB_URL -f "supabase/tests/056_blur_position_test.sql"
```
Expected: NOTICE `blur_position_on_land test PASSED`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/056_v07_mvp_blur_position_rpc.sql supabase/tests/056_blur_position_test.sql
git commit -m "feat(v0.7-mvp): mig 056 — RPC blur_position_on_land() with retry-until-land"
git push
```

---

### Task 2.3: Frontend — blurredPosition helper + toggle UI

**Files:**
- Create: `apps/explore-web/src/lib/blurredPosition.ts`
- Create: `apps/explore-web/src/components/settings/BrouillerPistesToggle.tsx`
- Modify: `apps/explore-web/src/hooks/usePlayer.ts` (intégration au login)

- [ ] **Step 1: Créer le helper blurredPosition.ts**

Create `apps/explore-web/src/lib/blurredPosition.ts`:

```typescript
import { supabase } from './supabase'

/**
 * V0.7 MVP — Cache de la position floutée pour la session courante.
 *
 * Stockage en mémoire (pas localStorage) — la position se réinitialise
 * à chaque ouverture d'app, ce qui est conforme à la spec
 * (recalcul UNIQUEMENT au lancement, pas à chaque update GPS).
 */
let cachedBlurred: { lat: number; lng: number } | null = null

/**
 * Calcule (une fois) une position floutée dans 50km, sur terre ferme.
 * Mémorise le résultat pour toute la session.
 * Si déjà calculée, retourne le cache.
 */
export async function getBlurredPosition(realLat: number, realLng: number): Promise<{ lat: number; lng: number }> {
  if (cachedBlurred) return cachedBlurred

  const { data, error } = await supabase.rpc('blur_position_on_land', {
    p_lat: realLat,
    p_lng: realLng,
  })

  if (error || !data || data.length === 0) {
    console.error('[blurredPosition] RPC failed, fallback to real position', error)
    cachedBlurred = { lat: realLat, lng: realLng }
    return cachedBlurred
  }

  cachedBlurred = { lat: data[0].blurred_lat, lng: data[0].blurred_lng }
  return cachedBlurred
}

/**
 * Force un nouveau calcul à la prochaine demande.
 * Utilisé quand le joueur active/désactive le toggle Brouiller en cours de session.
 */
export function resetBlurredPosition() {
  cachedBlurred = null
}
```

- [ ] **Step 2: Créer le composant Toggle**

Create `apps/explore-web/src/components/settings/BrouillerPistesToggle.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { resetBlurredPosition } from '../../lib/blurredPosition'

export function BrouillerPistesToggle() {
  const userId = usePlayerStore(s => s.userId)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  // Load current value
  useEffect(() => {
    if (!userId) return
    supabase
      .from('users')
      .select('brouiller_pistes')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setEnabled(data.brouiller_pistes)
      })
  }, [userId])

  async function handleToggle() {
    if (enabled === null || !userId || saving) return
    setSaving(true)
    const newValue = !enabled
    const { error } = await supabase
      .from('users')
      .update({ brouiller_pistes: newValue })
      .eq('id', userId)
    if (!error) {
      setEnabled(newValue)
      // Reset le cache pour forcer un nouveau tirage à la prochaine update GPS
      resetBlurredPosition()
    }
    setSaving(false)
  }

  if (enabled === null) return null

  return (
    <div className="settings-item">
      <div className="settings-item-info">
        <h3>Brouiller mes pistes</h3>
        <p>
          Pour préserver ton intimité, ta position affichée aux autres veilleurs
          est aléatoire dans un rayon de 50 km autour de toi. Activé par défaut.
        </p>
      </div>
      <button
        className={`toggle-switch ${enabled ? 'on' : 'off'}`}
        onClick={handleToggle}
        disabled={saving}
        aria-pressed={enabled}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Modifier usePlayer.ts pour utiliser blurredPosition**

Find the existing position-tracking logic in `apps/explore-web/src/hooks/usePlayer.ts` (search for `geolocation` or `getCurrentPosition`). Add the blurring step before sending to the server.

Example diff (à adapter au code existant) :

```typescript
// Before
const realPos = await getGeolocation()
broadcastPosition(realPos)  // sends real GPS to other players

// After
const realPos = await getGeolocation()
const { brouiller_pistes } = await fetchUserSettings()
const publicPos = brouiller_pistes
  ? await getBlurredPosition(realPos.lat, realPos.lng)
  : realPos
broadcastPosition(publicPos)
```

**Important** : `getBlurredPosition` cache le résultat — n'appeler `resetBlurredPosition()` que sur toggle on/off.

- [ ] **Step 4: Tester manuellement**

1. Lancer `pnpm dev` dans `apps/explore-web/`
2. Ouvrir l'app sur mobile (ou desktop avec géoloc)
3. Aller dans paramètres → activer "Brouiller mes pistes"
4. Vérifier qu'on voit son avatar à un endroit décalé (jusqu'à 50 km)
5. Désactiver → vérifier qu'on revient à la position réelle
6. Désactiver/activer plusieurs fois → vérifier que la position change à chaque toggle (= nouveau tirage)
7. Recharger l'app sans toggle → la position floutée doit rester **stable** (= cache de session)

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/lib/blurredPosition.ts apps/explore-web/src/components/settings/BrouillerPistesToggle.tsx apps/explore-web/src/hooks/usePlayer.ts
git commit -m "feat(v0.7-mvp): toggle Brouiller mes pistes — UI + position cache + integration"
git push
```

---

## Phase 3 — Feature 2 : Note partagée sur le profil

### Task 3.1: Migration 057 — colonnes profile_note + profile_note_updated_at

**Files:**
- Create: `supabase/migrations/057_v07_mvp_profile_note_columns.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/057_v07_mvp_profile_note_columns.sql`:

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — Add profile_note to users
-- =====================================================================
-- Petit mot éphémère que le joueur peut afficher sur son profil.
-- Visible par tous les autres joueurs au tap sur le profil.
-- Limite stricte 200 caractères (anti-spam).
-- =====================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_note text,
  ADD COLUMN IF NOT EXISTS profile_note_updated_at timestamptz;

-- Contrainte longueur côté DB en plus de la validation côté code
ALTER TABLE public.users
  ADD CONSTRAINT profile_note_length_chk
  CHECK (profile_note IS NULL OR char_length(profile_note) <= 200);

COMMENT ON COLUMN public.users.profile_note IS
  'V0.7 MVP — Petit mot du joueur visible sur son profil par tous. Max 200 chars. NULL si pas de note.';
COMMENT ON COLUMN public.users.profile_note_updated_at IS
  'V0.7 MVP — Timestamp dernière modification de profile_note.';
```

- [ ] **Step 2: Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 3: Vérifier**

```sql
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'users' AND column_name LIKE 'profile_note%';
-- Expected: 2 rows (profile_note text, profile_note_updated_at timestamptz)

-- Test contrainte longueur
UPDATE public.users SET profile_note = repeat('a', 201) WHERE id = (SELECT id FROM users LIMIT 1);
-- Expected: ERROR ... profile_note_length_chk violated
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/057_v07_mvp_profile_note_columns.sql
git commit -m "feat(v0.7-mvp): mig 057 — users.profile_note (max 200 char)"
git push
```

---

### Task 3.2: Migration 058 — RPC set_profile_note()

**Files:**
- Create: `supabase/migrations/058_v07_mvp_set_profile_note_rpc.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/058_v07_mvp_set_profile_note_rpc.sql`:

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — RPC set_profile_note
-- =====================================================================
-- Met à jour le mot du profil du joueur courant.
-- Validation : longueur <= 200 chars, p_note nullable (vidage explicite).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_profile_note(p_note text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_note IS NOT NULL AND char_length(p_note) > 200 THEN
    RAISE EXCEPTION 'profile_note too long (% chars > 200)', char_length(p_note);
  END IF;

  UPDATE public.users
    SET profile_note = NULLIF(trim(p_note), ''),
        profile_note_updated_at = v_now
    WHERE id = v_user_id;

  RETURN v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_note(text) TO authenticated;

COMMENT ON FUNCTION public.set_profile_note(text) IS
  'V0.7 MVP — Updates the auth user profile_note. Returns updated_at timestamp. NULL or empty string clears the note.';
```

- [ ] **Step 2: Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 3: Tester via SQL**

```sql
-- Comme auth user fictif (à remplacer par une session réelle ou mock auth.uid())
SELECT public.set_profile_note('Salut depuis Bordeaux');
-- Expected: timestamptz returned

SELECT profile_note, profile_note_updated_at FROM public.users WHERE id = auth.uid();
-- Expected: 'Salut depuis Bordeaux' + timestamp récent

SELECT public.set_profile_note('');
-- Expected: profile_note = NULL (empty string -> NULL)

SELECT public.set_profile_note(repeat('x', 250));
-- Expected: ERROR 'profile_note too long (250 chars > 200)'
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/058_v07_mvp_set_profile_note_rpc.sql
git commit -m "feat(v0.7-mvp): mig 058 — RPC set_profile_note() with 200 char limit"
git push
```

---

### Task 3.3: Modifier get_player_profile pour exposer profile_note

**Files:**
- Read: most recent migration on `get_player_profile` (mig 045 + 051)
- Create: `supabase/migrations/058b_v07_mvp_player_profile_with_note.sql`

- [ ] **Step 1: Lire la version actuelle de get_player_profile**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
cat supabase/migrations/051_v07_player_profile_coupe_crowns.sql
```

Identifier la signature complète et les champs retournés.

- [ ] **Step 2: Écrire la nouvelle migration**

Create `supabase/migrations/058b_v07_mvp_player_profile_with_note.sql`:

(Recopier la signature exacte de la mig 051 en ajoutant les 2 nouveaux champs `profile_note` et `profile_note_updated_at` à la SELECT et au RETURN TABLE.)

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — get_player_profile expose profile_note
-- =====================================================================
-- Ajoute profile_note + profile_note_updated_at au retour de la RPC
-- get_player_profile (héritée de mig 045+051).
-- =====================================================================

-- (Recopier exactement la signature et le corps de la mig 051,
-- en ajoutant les 2 colonnes profile_note et profile_note_updated_at
-- dans le RETURNS TABLE et dans le SELECT JSON aggregate.)

-- Voir le contenu précis de mig 051 et adapter.
```

**Important** : suivre la feedback memory `feedback_never_improvise_rpcs.md` — recopier exactement la signature précédente et y ajouter les 2 nouveaux champs, ne pas réécrire de zéro.

- [ ] **Step 3: Appliquer + tester**

```bash
pnpm dlx supabase db push
```

```sql
-- Test via SQL editor avec une session valide
SELECT * FROM get_player_profile('<un-user-id-existant>');
-- Expected: 2 nouveaux champs profile_note, profile_note_updated_at présents (NULL pour la plupart)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/058b_v07_mvp_player_profile_with_note.sql
git commit -m "feat(v0.7-mvp): mig 058b — get_player_profile exposes profile_note"
git push
```

---

### Task 3.4: Frontend — composant ProfileNoteEditor + intégration modale

**Files:**
- Create: `apps/explore-web/src/components/profile/ProfileNoteEditor.tsx`
- Modify: `apps/explore-web/src/components/map/PlayerProfileModal.tsx`

- [ ] **Step 1: Créer le composant ProfileNoteEditor**

Create `apps/explore-web/src/components/profile/ProfileNoteEditor.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  /** Si null, c'est l'affichage seul (lecture). Si non-null, c'est le profil du current user, on peut éditer. */
  isSelf: boolean
  initialNote: string | null
  onSaved?: (newNote: string | null) => void
}

const MAX_LEN = 200

export function ProfileNoteEditor({ isSelf, initialNote, onSaved }: Props) {
  const [note, setNote] = useState(initialNote ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setNote(initialNote ?? '') }, [initialNote])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    const trimmed = note.trim()
    const valueToSend = trimmed === '' ? null : trimmed
    const { error } = await supabase.rpc('set_profile_note', { p_note: valueToSend })
    if (!error) {
      onSaved?.(valueToSend)
      setEditing(false)
    } else {
      console.error('[ProfileNoteEditor] save error', error)
    }
    setSaving(false)
  }

  function handleCancel() {
    setNote(initialNote ?? '')
    setEditing(false)
  }

  // Lecture seule : autre joueur (pas de note → ne rien afficher)
  if (!isSelf) {
    if (!initialNote) return null
    return (
      <div className="profile-note profile-note-readonly">
        <span className="profile-note-pin">📍</span>
        <em>"{initialNote}"</em>
      </div>
    )
  }

  // Self : si pas en édition, afficher la note ou un placeholder cliquable
  if (!editing) {
    return (
      <button
        className="profile-note profile-note-self"
        onClick={() => setEditing(true)}
        type="button"
      >
        {initialNote ? <em>"{initialNote}"</em> : <span className="placeholder">✏️ Laisse un mot…</span>}
        <span className="edit-icon">✏️</span>
      </button>
    )
  }

  // Self en édition : textarea + boutons
  return (
    <div className="profile-note profile-note-editing">
      <textarea
        ref={inputRef}
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_LEN))}
        maxLength={MAX_LEN}
        rows={2}
        placeholder="Ton mot du moment (200 caractères max)…"
      />
      <div className="profile-note-footer">
        <span className="profile-note-counter">{note.length} / {MAX_LEN}</span>
        <button onClick={handleCancel} disabled={saving}>Annuler</button>
        <button onClick={handleSave} disabled={saving} className="primary">
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Intégrer dans PlayerProfileModal**

Find the section in `apps/explore-web/src/components/map/PlayerProfileModal.tsx` where the player name and faction are rendered (around line 415-490 based on prior exploration). Insert the ProfileNoteEditor right after the title pills, before the bio.

Diff:

```typescript
// At the top, add import
import { ProfileNoteEditor } from '../profile/ProfileNoteEditor'

// In the render, after the existing displayedTitles/factionTitle2 block:
<ProfileNoteEditor
  isSelf={isSelf}
  initialNote={profile.profile_note ?? null}
  onSaved={(newNote) => {
    setProfile(p => p ? { ...p, profile_note: newNote ?? undefined } : p)
  }}
/>
```

Also add `profile_note?: string | null` and `profile_note_updated_at?: string | null` to the `PlayerProfile` interface near line 51.

- [ ] **Step 3: Ajouter le CSS minimal**

Add to existing `PlayerProfileModal` styles (or `App.css` if global) :

```css
.profile-note {
  margin: 8px 0 12px;
  padding: 8px 12px;
  background: rgba(244, 228, 193, 0.5);
  border-left: 3px solid #c8534a;
  border-radius: 6px;
  font-style: italic;
  color: #4a2e0c;
  display: flex;
  align-items: center;
  gap: 8px;
}
.profile-note-readonly { font-size: 14px; }
.profile-note-self {
  cursor: pointer;
  border: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  background: rgba(244, 228, 193, 0.5);
}
.profile-note-self .placeholder { color: rgba(74, 46, 12, 0.5); }
.profile-note-editing textarea {
  width: 100%;
  font-family: inherit;
  font-style: italic;
  font-size: 14px;
  border: 1px solid #8a5a25;
  border-radius: 4px;
  padding: 6px 8px;
  resize: vertical;
}
.profile-note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
}
.profile-note-counter { color: rgba(74, 46, 12, 0.6); }
.profile-note-footer button.primary {
  background: #8a5a25;
  color: #f4e4c1;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}
```

- [ ] **Step 4: Tester manuellement**

1. Ouvrir son propre profil → voir le placeholder "✏️ Laisse un mot…"
2. Cliquer → textarea apparaît
3. Saisir un texte de 50 chars → bouton Enregistrer fonctionne, la note s'affiche
4. Saisir un texte de 250 chars → tronqué à 200 (front-side maxLength)
5. Vider le texte → Enregistrer → la note disparaît (NULL en DB)
6. Ouvrir le profil d'un autre joueur (qui a une note) → voir la note en lecture seule
7. Ouvrir le profil d'un autre joueur (qui n'a PAS de note) → la zone n'apparaît pas

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/profile/ProfileNoteEditor.tsx \
        apps/explore-web/src/components/map/PlayerProfileModal.tsx
git commit -m "feat(v0.7-mvp): ProfileNoteEditor — inline edit, 200 char limit, integrated in modal"
git push
```

---

## Phase 4 — Feature 3 : Avatars offline persistants en gris

### Task 4.1: Migration 059 — colonnes last_seen_*

**Files:**
- Create: `supabase/migrations/059_v07_mvp_last_seen_columns.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/059_v07_mvp_last_seen_columns.sql`:

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — Add last_seen columns to users
-- =====================================================================
-- Persistance de la dernière position publique du joueur, pour
-- afficher son avatar en gris pendant 24h après déconnexion.
-- =====================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_lat double precision,
  ADD COLUMN IF NOT EXISTS last_seen_lng double precision;

-- Index pour requêtes "joueurs vus dans les dernières 24h"
CREATE INDEX IF NOT EXISTS users_last_seen_at_idx ON public.users(last_seen_at)
  WHERE last_seen_at IS NOT NULL;

COMMENT ON COLUMN public.users.last_seen_at  IS 'V0.7 MVP — Timestamp dernière position publique. Permet TTL 24h pour avatars offline en gris.';
COMMENT ON COLUMN public.users.last_seen_lat IS 'V0.7 MVP — Dernière latitude publique (déjà floutée si brouiller_pistes=true).';
COMMENT ON COLUMN public.users.last_seen_lng IS 'V0.7 MVP — Dernière longitude publique (déjà floutée si brouiller_pistes=true).';
```

- [ ] **Step 2: Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 3: Vérifier**

```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'users' AND column_name LIKE 'last_seen%';
-- Expected: 3 rows
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/059_v07_mvp_last_seen_columns.sql
git commit -m "feat(v0.7-mvp): mig 059 — users.last_seen_at + last_seen_lat + last_seen_lng"
git push
```

---

### Task 4.2: Migration 060 — RPC update_last_seen()

**Files:**
- Create: `supabase/migrations/060_v07_mvp_update_last_seen_rpc.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/060_v07_mvp_update_last_seen_rpc.sql`:

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — RPC update_last_seen
-- =====================================================================
-- Met à jour la dernière position publique du joueur courant.
-- Appelé par le frontend toutes les ~60 sec quand l'app est active,
-- pour persister la dernière position avant déconnexion (= TTL 24h
-- pour l'avatar gris dans la carte).
--
-- p_lat / p_lng = position PUBLIQUE (déjà floutée si nécessaire).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_last_seen(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.users
    SET last_seen_at  = now(),
        last_seen_lat = p_lat,
        last_seen_lng = p_lng
    WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_last_seen(double precision, double precision) TO authenticated;

COMMENT ON FUNCTION public.update_last_seen(double precision, double precision) IS
  'V0.7 MVP — Persists user public position. Called periodically by frontend (~60sec). Used for offline grey avatar TTL 24h.';
```

- [ ] **Step 2: Appliquer + commit**

```bash
pnpm dlx supabase db push
git add supabase/migrations/060_v07_mvp_update_last_seen_rpc.sql
git commit -m "feat(v0.7-mvp): mig 060 — RPC update_last_seen() for offline persistence"
git push
```

---

### Task 4.3: Migration 061 — RPC get_offline_players()

**Files:**
- Create: `supabase/migrations/061_v07_mvp_get_offline_players_rpc.sql`
- Create: `supabase/tests/061_offline_players_test.sql`

- [ ] **Step 1: Écrire le test**

Create `supabase/tests/061_offline_players_test.sql`:

```sql
-- Test: get_offline_players() retourne les users avec last_seen_at < 24h ET non NULL
-- Pas de tri implicite, mais limite raisonnable (max 500 users à afficher sur carte)

DO $$
DECLARE
  result_count int;
BEGIN
  -- Setup: forcer last_seen_at à NOW() pour 1 user, à NOW() - 30h pour 1 autre
  UPDATE public.users SET last_seen_at = now(), last_seen_lat = 43.6, last_seen_lng = 1.4
    WHERE id = (SELECT id FROM users LIMIT 1);
  UPDATE public.users SET last_seen_at = now() - interval '30 hours', last_seen_lat = 43.6, last_seen_lng = 1.4
    WHERE id = (SELECT id FROM users OFFSET 1 LIMIT 1);

  SELECT COUNT(*) INTO result_count FROM public.get_offline_players();

  -- On attend au moins le 1er user (l'autre est exclu car > 24h)
  ASSERT result_count >= 1, format('Expected at least 1 player, got %s', result_count);

  -- Vérifie que le user > 24h n'est pas dedans
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.get_offline_players() r
    WHERE r.user_id = (SELECT id FROM users OFFSET 1 LIMIT 1)
  ), 'User > 24h should not be in offline_players';

  RAISE NOTICE 'get_offline_players test PASSED';
END;
$$;
```

- [ ] **Step 2: Exécuter le test → fail attendu**

```bash
psql $SUPABASE_DB_URL -f "supabase/tests/061_offline_players_test.sql"
```
Expected: `function get_offline_players does not exist`.

- [ ] **Step 3: Écrire la migration**

Create `supabase/migrations/061_v07_mvp_get_offline_players_rpc.sql`:

```sql
-- =====================================================================
-- V0.7 MVP ECO Merveille — RPC get_offline_players
-- =====================================================================
-- Retourne les joueurs avec une dernière position publique < 24h.
-- Utilisé par le frontend au lancement de l'app pour afficher les
-- avatars en gris (puis Realtime/Presence prend le relais pour les online).
--
-- TTL 24h : on filtre last_seen_at >= NOW() - 24h (cf. spec §5.2).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_offline_players()
RETURNS TABLE(
  user_id          uuid,
  name             text,
  faction_color    text,
  faction_pattern  text,
  avatar_url       text,
  last_seen_at     timestamptz,
  last_seen_lat    double precision,
  last_seen_lng    double precision,
  profile_note     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.name,
    f.color AS faction_color,
    f.pattern AS faction_pattern,
    u.profile_image AS avatar_url,
    u.last_seen_at,
    u.last_seen_lat,
    u.last_seen_lng,
    u.profile_note
  FROM public.users u
  LEFT JOIN public.factions f ON f.id = u.faction_id
  WHERE u.last_seen_at IS NOT NULL
    AND u.last_seen_at >= now() - interval '24 hours'
    AND u.last_seen_lat IS NOT NULL
    AND u.last_seen_lng IS NOT NULL
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.get_offline_players() TO authenticated;

COMMENT ON FUNCTION public.get_offline_players() IS
  'V0.7 MVP — Returns players seen <24h ago with their last public position. Frontend overlays Realtime/Presence (online players) on top of this baseline.';
```

**Note** : faction columns/table à confirmer (peut s'appeler `factions` ou autre — vérifier dans schéma).

- [ ] **Step 4: Appliquer + ré-exécuter le test**

```bash
pnpm dlx supabase db push
psql $SUPABASE_DB_URL -f "supabase/tests/061_offline_players_test.sql"
```
Expected: NOTICE `get_offline_players test PASSED`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/061_v07_mvp_get_offline_players_rpc.sql supabase/tests/061_offline_players_test.sql
git commit -m "feat(v0.7-mvp): mig 061 — RPC get_offline_players() with 24h TTL"
git push
```

---

### Task 4.4: Frontend — playersStore + appel update_last_seen périodique

**Files:**
- Modify: `apps/explore-web/src/stores/playersStore.ts`
- Modify: `apps/explore-web/src/hooks/usePlayer.ts`

- [ ] **Step 1: Étendre l'interface OnlinePlayer**

In `apps/explore-web/src/stores/playersStore.ts`, modify the interface:

```typescript
export interface OnlinePlayer {
  userId: string
  name: string
  position: { lng: number; lat: number }
  factionColor: string | null
  factionPattern: string | null
  avatarUrl: string | null
  displayedTitles: string[]
  lastSeen: number          // unix timestamp ms
  isOffline?: boolean       // V0.7 MVP — true si chargé via get_offline_players (vs Realtime)
  profileNote?: string | null  // V0.7 MVP
}

interface PlayersState {
  players: Map<string, OnlinePlayer>
  setPlayer: (player: OnlinePlayer) => void
  removePlayer: (userId: string) => void
  clearAll: () => void
  /** V0.7 MVP — bulk-load offline players (gardés en mémoire jusqu'à override par Realtime) */
  loadOfflinePlayers: (offlinePlayers: OnlinePlayer[]) => void
}

export const usePlayersStore = create<PlayersState>((set) => ({
  players: new Map(),

  setPlayer: (player) =>
    set((state) => {
      const next = new Map(state.players)
      // Si déjà présent et online (isOffline=false), ne pas écraser avec un offline
      const existing = next.get(player.userId)
      if (existing && !existing.isOffline && player.isOffline) return state
      next.set(player.userId, player)
      return { players: next }
    }),

  removePlayer: (userId) =>
    set((state) => {
      const next = new Map(state.players)
      next.delete(userId)
      return { players: next }
    }),

  clearAll: () => set({ players: new Map() }),

  loadOfflinePlayers: (offlinePlayers) =>
    set((state) => {
      const next = new Map(state.players)
      for (const p of offlinePlayers) {
        // N'écrase pas un online (isOffline=false) déjà présent
        const existing = next.get(p.userId)
        if (existing && !existing.isOffline) continue
        next.set(p.userId, { ...p, isOffline: true })
      }
      return { players: next }
    }),
}))
```

- [ ] **Step 2: Charger les offline au lancement (dans usePlayer.ts ou MapPage.tsx)**

In the appropriate init hook (probably `usePlayer.ts` after auth, or `MapPage.tsx` on mount), add:

```typescript
import { supabase } from '../lib/supabase'
import { usePlayersStore } from '../stores/playersStore'

// At session start:
async function loadOfflinePlayersOnce() {
  const { data, error } = await supabase.rpc('get_offline_players')
  if (error || !data) {
    console.error('[loadOfflinePlayers]', error)
    return
  }
  const offlinePlayers = data.map((p: any) => ({
    userId: p.user_id,
    name: p.name,
    position: { lat: p.last_seen_lat, lng: p.last_seen_lng },
    factionColor: p.faction_color,
    factionPattern: p.faction_pattern,
    avatarUrl: p.avatar_url,
    displayedTitles: [],
    lastSeen: new Date(p.last_seen_at).getTime(),
    isOffline: true,
    profileNote: p.profile_note,
  }))
  usePlayersStore.getState().loadOfflinePlayers(offlinePlayers)
}

// Call once on mount:
useEffect(() => { loadOfflinePlayersOnce() }, [])
```

- [ ] **Step 3: Appeler update_last_seen périodiquement**

In the same hook where the position is broadcast via Realtime, after broadcast, also persist to DB :

```typescript
// every 60 sec when app is active
useEffect(() => {
  if (!userId || !publicPosition) return
  const interval = setInterval(() => {
    supabase.rpc('update_last_seen', {
      p_lat: publicPosition.lat,
      p_lng: publicPosition.lng,
    })
  }, 60_000)
  return () => clearInterval(interval)
}, [userId, publicPosition])
```

**Important** : `publicPosition` doit être la position floutée si `brouiller_pistes` est activé. Pas la position GPS réelle.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/stores/playersStore.ts apps/explore-web/src/hooks/usePlayer.ts
git commit -m "feat(v0.7-mvp): playersStore offline support + update_last_seen periodic call"
git push
```

---

### Task 4.5: Frontend — rendu avatars offline en gris

**Files:**
- Modify: `apps/explore-web/src/components/map/OnlinePlayerMarkers.tsx`
- Modify: `apps/explore-web/src/components/map/OnlinePlayerMarkers.css`

- [ ] **Step 1: Lire le composant existant**

```bash
cat "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web/src/components/map/OnlinePlayerMarkers.tsx" | head -80
```

Identifier où chaque marker est rendu et ajouter une classe conditionnelle.

- [ ] **Step 2: Modifier le composant**

Trouver la map dans `OnlinePlayerMarkers.tsx` qui itère sur les players. Ajouter une classe conditionnelle :

```typescript
const players = Array.from(usePlayersStore(s => s.players).values())

// Dans le render :
{players.map(player => (
  <div
    key={player.userId}
    className={`user-marker-wrapper ${player.isOffline ? 'is-offline' : ''}`}
    // ... existing positioning
  >
    {/* ... existing avatar markup */}
  </div>
))}
```

- [ ] **Step 3: Modifier le CSS**

In `apps/explore-web/src/components/map/OnlinePlayerMarkers.css`, append:

```css
/* V0.7 MVP — offline avatars en gris désaturé */
.user-marker-wrapper.is-offline {
  filter: grayscale(0.85) brightness(0.85);
  opacity: 0.65;
}

/* Pas de pastille verte pour les offline */
.user-marker-wrapper.is-offline .user-online-dot {
  display: none;
}
```

- [ ] **Step 4: Modifier PlayerProfileModal pour afficher "Vu il y a X"**

In `PlayerProfileModal.tsx`, near the player name and faction display, conditionally show :

```typescript
{profile.is_offline && profile.last_seen_at && (
  <div className="profile-last-seen">
    Vu il y a {formatRelativeDate(profile.last_seen_at)}
  </div>
)}
```

(`formatRelativeDate` already exists in the file, line 104.)

- [ ] **Step 5: Tester manuellement**

1. Avec deux comptes A et B, A se connecte et bouge sur la carte
2. A ferme l'app
3. Sur le compte B, on continue à voir l'avatar de A à sa dernière position, en **gris**
4. Modifier la base : `UPDATE users SET last_seen_at = now() - interval '25 hours' WHERE id = '<A_id>'`
5. Recharger l'app sur le compte B → A n'est plus visible (TTL 24h dépassé)
6. A se reconnecte → son avatar redevient coloré + pastille verte

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/components/map/OnlinePlayerMarkers.tsx \
        apps/explore-web/src/components/map/OnlinePlayerMarkers.css \
        apps/explore-web/src/components/map/PlayerProfileModal.tsx
git commit -m "feat(v0.7-mvp): offline avatars en gris (desaturate filter) + 'Vu il y a X' in modal"
git push
```

---

## Phase 5 — Tests d'intégration end-to-end + deploy

### Task 5.1: Smoke test complet en environnement dev

**Files:** none

- [ ] **Step 1: Lancer le frontend en dev**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm dev
```

- [ ] **Step 2: Tests manuels en parallèle (3 navigateurs / 3 comptes)**

Procédure :
1. **Compte A** : se connecte, active "Brouiller mes pistes". Sa position s'affiche décalée jusqu'à 50 km.
2. **Compte B** : se connecte, voit la position décalée de A.
3. **Compte A** : pose une note "Bonjour de Bordeaux !".
4. **Compte B** : ouvre le profil de A → voit la note.
5. **Compte A** : ferme l'app.
6. **Compte B** : 1 min plus tard, voit A en gris à sa dernière position.
7. **Compte C** : nouveau compte créé → "Brouiller mes pistes" est activé par défaut.

- [ ] **Step 3: Si tous les tests passent, merge sur main**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
git checkout main
git pull
git merge v07-eco-merveille-mvp --no-ff
git push
```

---

### Task 5.2: Deploy Netlify (explore-web)

**Files:** none

- [ ] **Step 1: Build prod**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm build
```
Expected: build OK, dist/ généré.

- [ ] **Step 2: Deploy Netlify (chemin absolu obligatoire)**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
netlify deploy --prod --dir "$PWD/dist" --no-build
```
Expected: déploiement OK, URL prod renvoyée.

- [ ] **Step 3: Smoke test en prod**

Ouvrir `https://carte.runesdechene.com` :
1. Vérifier que les nouveaux comptes ont brouiller_pistes activé
2. Vérifier que la note se sauvegarde et s'affiche
3. Fermer l'app, attendre 2 min, rouvrir → voir des avatars en gris (anciens connectés)

- [ ] **Step 4: Annoncer dans le changelog**

Modifier `apps/explore-web/CHANGELOG.md` pour documenter les 3 nouvelles features (sans spoilers, ton public).

```bash
# Edit CHANGELOG.md, then :
git add apps/explore-web/CHANGELOG.md
git commit -m "docs: changelog V0.7 MVP — Brouiller mes pistes / Note du profil / Avatars offline"
git push
```

---

## Self-Review Checklist

Avant de considérer le plan comme prêt à exécution :

- [ ] **Spec coverage** :
  - Toggle Brouiller : Phase 2 ✅ (mig 054-056 + frontend)
  - Note partagée : Phase 3 ✅ (mig 057-058b + frontend)
  - Avatars offline en gris : Phase 4 ✅ (mig 059-061 + frontend)
  - PostGIS + dataset Natural Earth : Task 1.2 ✅
  - Position floutée stable au lancement : Task 2.3 step 1 ✅ (cache de session)
  - TTL 24h : Task 4.3 step 3 ✅ (WHERE last_seen_at >= NOW() - 24h)
  - Premier compte / pas de GPS : Task 2.3 step 3 (à confirmer dans le code de usePlayer.ts au moment du dev)

- [ ] **Pas de placeholders** : tous les snippets de code sont écrits intégralement, pas de "à compléter".

- [ ] **Type consistency** : `OnlinePlayer.isOffline?` cohérent partout, `profile_note: string | null` cohérent entre RPC et frontend.

- [ ] **Numérotation des migrations** : 054 → 061 sans trou, ordre cohérent.

- [ ] **Convention de commit** : tous les commits suivent `<type>(v0.7-mvp): <description>`.

---

## Notes pour l'exécution

- **Toujours `pnpm dlx supabase db push`** pour appliquer les migrations (pas direct via SQL editor — sinon hors versionning).
- **Tester chaque migration immédiatement** avant de passer à la suivante (l'historique d'incidents montre que sinon les bugs s'enchaînent).
- **Ne pas modifier les tables sans migration** (DB dev = prod alpha — Uriel a des users actifs).
- **Push fréquent** (cf. `feedback_commit_every_change.md`) — pas de "session sans push".
- **Vérifier le naming exact des tables** : `factions` pour les héritages, `users` pour les profils. Si différent, adapter.
- **Si une RPC existante doit être étendue** (ex: `get_player_profile`) : recopier exactement la signature précédente, ajouter les nouveaux champs, ne pas réécrire de zéro (cf. `feedback_never_improvise_rpcs.md`).

---

## Risques & atténuations à l'exécution

| Risque | Atténuation |
|---|---|
| Le seed Natural Earth est trop lourd dans une seule migration (~3 MB de SQL) | Si Supabase rejette, splitter en `054_a_postgis_extension.sql` + `054_b_landmasses_seed.sql`. Le seed peut être appliqué en plusieurs fois. |
| `is_on_land` lent sur le test 50× | L'index GIST devrait suffire. Si > 200 ms, tester avec ST_Subdivide() pour réduire la complexité des polygones. |
| Permission GPS refusée / position non récupérable | `usePlayer.ts` doit tomber sur "pas de position publique" (ne pas crasher). À vérifier explicitement au moment du dev. |
| `update_last_seen` toutes les 60 sec → trop d'écritures DB | 1 UPDATE/min/user actif = ~quelques centaines d'UPDATE/min en pic. Largement supporté. Si nécessaire plus tard, batcher côté serveur. |
| Le dataset Natural Earth reproduit mal certaines petites îles | Pour le MVP c'est acceptable — les joueurs au Vatican ou sur une île privée ne sont pas la majorité. Si signalé : mettre à jour vers `ne_10m_land` (10 MB, précis 1:10m). |
