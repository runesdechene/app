# Brouillage GPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux joueurs d'activer un toggle "Brouiller mes pistes" qui rend leur position publique (vue par les autres voyageurs) aléatoire dans 50 km, sur terre ferme uniquement, tout en conservant leur vraie position GPS pour leur propre affichage et pour la mécanique GPS de découverte de lieux.

**Architecture:** Asymétrique soi/autres. La position publique est calculée **côté client** dans `usePresence.ts` avant le `channel.track()` Supabase Realtime. Si toggle ON, on appelle une RPC PostGIS `randomize_position_on_land` qui retourne une position aléatoire dans 50 km sur terre ferme (dataset Natural Earth `ne_50m_land`), et on cache le résultat pour la session. Pour soi, `usePlayerStore.userPosition` reste la vraie position GPS, jamais altérée.

**Tech Stack:** Supabase (Postgres + PostGIS), Supabase Realtime presence channels, React 18 + TypeScript strict, Zustand, MapLibre GL.

**Spec source:** [`docs/superpowers/specs/2026-05-01-v07-eco-merveille-mvp-design.md`](../specs/2026-05-01-v07-eco-merveille-mvp-design.md) §3 (incluant §3.5 asymétrie soi/autres).

---

## File Structure

### Créés

- `supabase/migrations/054_v07_brouillage_gps.sql` — schéma : colonne `users.brouiller_pistes`, table `landmasses`, fonctions `is_on_land` + `randomize_position_on_land`, RPCs settings
- `supabase/data/ne_50m_land.geojson` — dataset Natural Earth (3 MB, téléchargé une fois)
- `scripts/import-landmasses.ts` — script Node qui INSERT le GeoJSON dans `landmasses`
- `apps/explore-web/src/hooks/useUserSettings.ts` — fetch + update du toggle `brouiller_pistes`
- `apps/explore-web/src/components/profile/SettingsModal.tsx` — modale paramètres avec le toggle
- `apps/explore-web/src/components/profile/SettingsModal.css` — styles

### Modifiés

- `apps/explore-web/src/hooks/usePresence.ts` — calculer la position publique floutée si toggle ON
- `apps/explore-web/src/components/map/MobileNavbar.tsx` — bouton "⚙️ Paramètres" qui ouvre `SettingsModal`
- `apps/explore-web/src/stores/playerStore.ts` — ajout du flag `brouillerPistes` (cache local)

### Conventions

- **Migrations** : numérotation continue, format `NNN_v07_*.sql`
- **TypeScript strict** : pas de `any`, pas de `console.log`
- **Style commit** : Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- **Test** : pas de framework de test unitaire dans `explore-web`. Validation manuelle in-browser + via Supabase Studio pour les RPCs

---

## Task 1 — Migration SQL : schéma + landmasses + fonctions PostGIS

**Files:**
- Create: `supabase/migrations/054_v07_brouillage_gps.sql`
- Create: `supabase/data/ne_50m_land.geojson`

- [ ] **Step 1 : Télécharger le dataset Natural Earth `ne_50m_land`**

Source : https://www.naturalearthdata.com/downloads/50m-physical-vectors/

Télécharger le ZIP "Land" (50m physical vectors). Extraire `ne_50m_land.shp/.shx/.dbf/.prj` puis convertir en GeoJSON :

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 ne_50m_land.geojson ne_50m_land.shp
```

(Si `ogr2ogr` n'est pas dispo : alternative avec QGIS, ou télécharger directement la version GeoJSON depuis https://github.com/nvkelso/natural-earth-vector/raw/master/geojson/ne_50m_land.geojson)

Placer le fichier dans `supabase/data/ne_50m_land.geojson`. Taille attendue : ~3 MB.

- [ ] **Step 2 : Créer la migration SQL `054_v07_brouillage_gps.sql`**

```sql
-- 054_v07_brouillage_gps.sql
-- V0.7+ Brouillage GPS — toggle privacy + randomisation côté serveur sur terre ferme
-- Dataset landmasses : Natural Earth ne_50m_land (importé via scripts/import-landmasses.ts)

-- Activer PostGIS si pas déjà actif
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Colonne sur users — toggle activé par défaut (privacy-by-default)
ALTER TABLE users ADD COLUMN IF NOT EXISTS brouiller_pistes boolean NOT NULL DEFAULT true;

-- 2. Table landmasses pour vérification "sur terre"
CREATE TABLE IF NOT EXISTS landmasses (
  id serial PRIMARY KEY,
  geom geometry(MultiPolygon, 4326) NOT NULL
);

-- Index spatial pour ST_Contains rapide
CREATE INDEX IF NOT EXISTS idx_landmasses_geom ON landmasses USING GIST(geom);

-- 3. Fonction utilitaire is_on_land(lat, lng) — true si le point est sur terre ferme
CREATE OR REPLACE FUNCTION is_on_land(p_lat double precision, p_lng double precision)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM landmasses
    WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
  );
$$;

COMMENT ON FUNCTION is_on_land IS 'Brouillage GPS V0.7+ — vérifie qu''un point lat/lng est sur terre ferme via dataset Natural Earth ne_50m_land.';

-- 4. RPC randomize_position_on_land — génère un point aléatoire dans 50 km sur terre
-- Algorithme : disque uniforme + retry max 15× sinon fallback à la position d'entrée
CREATE OR REPLACE FUNCTION randomize_position_on_land(
  p_lat double precision,
  p_lng double precision
)
RETURNS TABLE(out_lat double precision, out_lng double precision)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_radius_km constant double precision := 50.0;
  v_earth_radius_km constant double precision := 6371.0;
  v_max_attempts constant integer := 15;
  v_attempt integer;
  v_u double precision;
  v_v double precision;
  v_w double precision;
  v_t double precision;
  v_offset_lat double precision;
  v_offset_lng double precision;
  v_rand_lat double precision;
  v_rand_lng double precision;
BEGIN
  -- Distribution uniforme sur disque : sqrt + cos/sin
  -- cf. https://stackoverflow.com/a/50746409
  FOR v_attempt IN 1..v_max_attempts LOOP
    v_u := random();
    v_v := random();
    v_w := v_radius_km / v_earth_radius_km * sqrt(v_u);  -- distance angulaire
    v_t := 2 * pi() * v_v;                               -- angle
    v_offset_lat := degrees(v_w * cos(v_t));
    -- Correction longitude par cos(latitude) pour distorsion mercator locale
    v_offset_lng := degrees(v_w * sin(v_t)) / cos(radians(p_lat));
    v_rand_lat := p_lat + v_offset_lat;
    v_rand_lng := p_lng + v_offset_lng;

    IF is_on_land(v_rand_lat, v_rand_lng) THEN
      RETURN QUERY SELECT v_rand_lat, v_rand_lng;
      RETURN;
    END IF;
  END LOOP;

  -- Fail-safe : aucun point sur terre trouvé après 15 essais → retourne la position d'entrée
  RETURN QUERY SELECT p_lat, p_lng;
END;
$$;

COMMENT ON FUNCTION randomize_position_on_land IS 'Brouillage GPS V0.7+ — génère un point aléatoire dans 50 km sur terre ferme. Fallback à la position d''entrée si aucun point terre trouvé en 15 essais.';

GRANT EXECUTE ON FUNCTION randomize_position_on_land TO authenticated;
GRANT EXECUTE ON FUNCTION is_on_land TO authenticated;

-- 5. RPC get_user_settings — retourne les settings du user courant
CREATE OR REPLACE FUNCTION get_user_settings()
RETURNS TABLE(brouiller_pistes boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.brouiller_pistes
  FROM users u
  WHERE u.id = auth.uid();
$$;

COMMENT ON FUNCTION get_user_settings IS 'Retourne les settings du user courant. V0.7+ : brouiller_pistes uniquement, à étendre selon besoins futurs.';

GRANT EXECUTE ON FUNCTION get_user_settings TO authenticated;

-- 6. RPC set_user_setting_brouiller_pistes — update le toggle
CREATE OR REPLACE FUNCTION set_user_setting_brouiller_pistes(p_value boolean)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users SET brouiller_pistes = p_value WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION set_user_setting_brouiller_pistes IS 'Update le toggle brouiller_pistes du user courant.';

GRANT EXECUTE ON FUNCTION set_user_setting_brouiller_pistes TO authenticated;
```

- [ ] **Step 3 : Appliquer la migration en local**

Run :
```bash
cd "apps/explore-web" && pnpm dlx supabase db push
```

Expected : ✅ migration `054_v07_brouillage_gps.sql` appliquée. Si l'extension PostGIS n'est pas activée, la commande peut échouer — dans ce cas, ouvrir Supabase Studio en local → Database → Extensions → activer `postgis` manuellement, puis relancer `db push`.

- [ ] **Step 4 : Vérifier en local que la table `landmasses` existe et est vide**

Via Supabase Studio (local) → Table Editor → vérifier que `landmasses` apparaît avec 0 row. Vérifier aussi que `users.brouiller_pistes` apparaît dans la table `users` avec valeur `true` partout (backfill du DEFAULT).

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/054_v07_brouillage_gps.sql supabase/data/ne_50m_land.geojson
git commit -m "feat(v0.7+): migration brouillage GPS — schéma + fonctions PostGIS

- Colonne users.brouiller_pistes (boolean, défaut true)
- Table landmasses + index spatial
- Fonctions is_on_land + randomize_position_on_land
- RPCs get_user_settings + set_user_setting_brouiller_pistes
- Dataset Natural Earth ne_50m_land.geojson inclus"
```

---

## Task 2 — Script d'import des landmasses

**Files:**
- Create: `scripts/import-landmasses.ts`

- [ ] **Step 1 : Créer le script Node**

```typescript
// scripts/import-landmasses.ts
// Import du dataset Natural Earth ne_50m_land dans la table landmasses.
// À lancer une seule fois après la migration 054, en local et en prod.
//
// Usage : pnpm tsx scripts/import-landmasses.ts
//
// Variables d'environnement requises :
//   SUPABASE_URL          (ex: https://xxx.supabase.co ou http://localhost:54321 en local)
//   SUPABASE_SERVICE_ROLE (clé service_role — pas anon — pour pouvoir bypass RLS)

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE
if (!url || !serviceRole) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env')
  process.exit(1)
}

const client = createClient(url, serviceRole)

const geojsonPath = join(process.cwd(), 'supabase', 'data', 'ne_50m_land.geojson')
const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as {
  type: 'FeatureCollection'
  features: Array<{ type: 'Feature'; geometry: unknown }>
}

async function main() {
  console.log(`Importing ${geojson.features.length} landmasses…`)

  // Wipe avant import (idempotent)
  const wipe = await client.from('landmasses').delete().neq('id', 0)
  if (wipe.error) throw wipe.error

  // Insert un par un (les features Natural Earth ne_50m sont peu nombreuses : ~127)
  for (let i = 0; i < geojson.features.length; i++) {
    const feature = geojson.features[i]
    const geomJson = JSON.stringify(feature.geometry)
    // PostGIS attend une géométrie convertie via ST_GeomFromGeoJSON, donc on passe par une RPC inline
    const { error } = await client.rpc('insert_landmass', { p_geojson: geomJson })
    if (error) {
      console.error(`Failed to insert feature ${i}:`, error)
      throw error
    }
    if (i % 20 === 0) console.log(`  ${i + 1} / ${geojson.features.length}`)
  }

  const count = await client.from('landmasses').select('id', { count: 'exact', head: true })
  console.log(`Done. ${count.count} landmasses in table.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2 : Ajouter une RPC helper `insert_landmass` dans la migration 054**

Modifier `supabase/migrations/054_v07_brouillage_gps.sql`, ajouter avant la fin :

```sql
-- Helper RPC pour le script d'import (sécurisé : service_role uniquement)
CREATE OR REPLACE FUNCTION insert_landmass(p_geojson text)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
  INSERT INTO landmasses (geom)
  SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326));
$$;

-- Pas de GRANT — accessible uniquement via service_role (bypass RLS)
```

- [ ] **Step 3 : Re-appliquer la migration**

```bash
cd "apps/explore-web" && pnpm dlx supabase db push
```

- [ ] **Step 4 : Lancer le script d'import en local**

```bash
SUPABASE_URL="http://localhost:54321" \
SUPABASE_SERVICE_ROLE="$(supabase status -o json | jq -r .SERVICE_ROLE_KEY)" \
pnpm tsx scripts/import-landmasses.ts
```

Expected : `Done. ~127 landmasses in table.` (le nombre exact dépend du dataset Natural Earth).

- [ ] **Step 5 : Tester `is_on_land` manuellement**

Via Supabase Studio (local) → SQL Editor :

```sql
SELECT is_on_land(48.8566, 2.3522);   -- Paris → true
SELECT is_on_land(0.0, 0.0);          -- océan Atlantique → false
SELECT is_on_land(43.6047, 1.4442);   -- Toulouse → true
SELECT is_on_land(35.0, -40.0);       -- milieu de l'Atlantique → false
```

Expected : true / false / true / false.

- [ ] **Step 6 : Tester `randomize_position_on_land` manuellement**

```sql
-- Lancer 5 fois, vérifier que les résultats sont dans ~50 km de Paris et tous sur terre
SELECT * FROM randomize_position_on_land(48.8566, 2.3522);
SELECT * FROM randomize_position_on_land(48.8566, 2.3522);
SELECT * FROM randomize_position_on_land(48.8566, 2.3522);
SELECT * FROM randomize_position_on_land(48.8566, 2.3522);
SELECT * FROM randomize_position_on_land(48.8566, 2.3522);
```

Expected : 5 paires (lat, lng) toutes différentes, toutes dans 50 km de Paris, toutes sur terre. Vérifier visuellement sur une carte (genre Google Maps) que les points sont bien sur la terre française.

- [ ] **Step 7 : Commit**

```bash
git add scripts/import-landmasses.ts supabase/migrations/054_v07_brouillage_gps.sql
git commit -m "feat(v0.7+): script d'import des landmasses + RPC helper insert_landmass"
```

---

## Task 3 — Hook frontend `useUserSettings`

**Files:**
- Create: `apps/explore-web/src/hooks/useUserSettings.ts`

- [ ] **Step 1 : Créer le hook**

```typescript
// apps/explore-web/src/hooks/useUserSettings.ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface UserSettings {
  brouillerPistes: boolean
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch initial
  useEffect(() => {
    let cancelled = false
    async function fetchSettings() {
      const { data, error } = await supabase.rpc('get_user_settings').single()
      if (cancelled) return
      if (error) {
        // Fallback : on assume true (privacy-by-default) si fetch échoue
        setSettings({ brouillerPistes: true })
      } else {
        setSettings({ brouillerPistes: (data as { brouiller_pistes: boolean }).brouiller_pistes })
      }
      setLoading(false)
    }
    fetchSettings()
    return () => { cancelled = true }
  }, [])

  // Update brouiller_pistes (optimistic)
  const setBrouillerPistes = useCallback(async (value: boolean) => {
    setSettings(prev => prev ? { ...prev, brouillerPistes: value } : { brouillerPistes: value })
    const { error } = await supabase.rpc('set_user_setting_brouiller_pistes', { p_value: value })
    if (error) {
      // Revert si erreur
      setSettings(prev => prev ? { ...prev, brouillerPistes: !value } : null)
      throw error
    }
  }, [])

  return { settings, loading, setBrouillerPistes }
}
```

- [ ] **Step 2 : Tester le hook in-browser**

Lancer le dev server :
```bash
cd "apps/explore-web" && pnpm dev
```

Ouvrir DevTools console, créer un composant temporaire ou injecter via React DevTools un appel à `useUserSettings()` — vérifier que `settings.brouillerPistes` est bien `true` (par défaut). Pas besoin de commit cette étape, c'est juste un test ponctuel.

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/hooks/useUserSettings.ts
git commit -m "feat(v0.7+): hook useUserSettings — fetch + update toggle brouiller_pistes"
```

---

## Task 4 — Composant `SettingsModal`

**Files:**
- Create: `apps/explore-web/src/components/profile/SettingsModal.tsx`
- Create: `apps/explore-web/src/components/profile/SettingsModal.css`

- [ ] **Step 1 : Créer le CSS**

```css
/* apps/explore-web/src/components/profile/SettingsModal.css */
.settings-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(40, 30, 20, 0.55);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.settings-modal {
  background: #fdf3d6;
  border: 1px solid #c8a874;
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  font-size: 16px;
  color: #3a2a1a;
}

.settings-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(120, 90, 40, 0.18);
}

.settings-modal__title {
  margin: 0;
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.5rem;
  color: #5a3a1a;
}

.settings-modal__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #7a4a1a;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.settings-modal__body {
  padding: 1.25rem;
}

.settings-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(120, 90, 40, 0.1);
}

.settings-row:last-child {
  border-bottom: none;
}

.settings-row__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.settings-row__label {
  font-weight: 600;
  font-size: 1rem;
}

.settings-row__description {
  font-size: 0.9rem;
  color: #5a4a3a;
  line-height: 1.4;
}

/* Toggle switch */
.settings-toggle {
  position: relative;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
}

.settings-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.settings-toggle__slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #d4c4a8;
  border-radius: 14px;
  transition: 0.2s;
}

.settings-toggle__slider::before {
  position: absolute;
  content: '';
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.settings-toggle input:checked + .settings-toggle__slider {
  background-color: #7a9a5a;
}

.settings-toggle input:checked + .settings-toggle__slider::before {
  transform: translateX(20px);
}
```

- [ ] **Step 2 : Créer le composant**

```tsx
// apps/explore-web/src/components/profile/SettingsModal.tsx
import { useUserSettings } from '../../hooks/useUserSettings'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, loading, setBrouillerPistes } = useUserSettings()

  if (!isOpen) return null

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal__header">
          <h2 className="settings-modal__title">Paramètres</h2>
          <button className="settings-modal__close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="settings-modal__body">
          {loading || !settings ? (
            <p style={{ opacity: 0.7 }}>Chargement…</p>
          ) : (
            <div className="settings-row">
              <div className="settings-row__top">
                <span className="settings-row__label">Brouiller mes pistes</span>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.brouillerPistes}
                    onChange={e => { void setBrouillerPistes(e.target.checked) }}
                  />
                  <span className="settings-toggle__slider"></span>
                </label>
              </div>
              <p className="settings-row__description">
                Pour préserver ton intimité, ta position affichée aux autres veilleurs est aléatoire dans un rayon de 50 km autour de toi. Toi tu vois toujours ta vraie position. Activé par défaut.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/components/profile/SettingsModal.tsx apps/explore-web/src/components/profile/SettingsModal.css
git commit -m "feat(v0.7+): composant SettingsModal avec toggle Brouiller mes pistes"
```

---

## Task 5 — Bouton Paramètres dans le HUD

**Files:**
- Modify: `apps/explore-web/src/components/map/MobileNavbar.tsx`

- [ ] **Step 1 : Lire le fichier actuel**

Lire `apps/explore-web/src/components/map/MobileNavbar.tsx` pour repérer la structure (boutons existants, state ouvert/fermé, imports).

- [ ] **Step 2 : Ajouter l'état d'ouverture du SettingsModal**

Ajouter en haut du composant :
```tsx
import { useState } from 'react'
import { SettingsModal } from '../profile/SettingsModal'

// Dans le composant :
const [settingsOpen, setSettingsOpen] = useState(false)
```

- [ ] **Step 3 : Ajouter le bouton ⚙️**

Dans le rendu de la navbar, ajouter un bouton qui suit le style des autres boutons existants. Si la navbar est un `<nav>` avec des `<button>`, ajouter :

```tsx
<button
  type="button"
  className="mobile-navbar__btn"  /* ou la classe existante */
  onClick={() => setSettingsOpen(true)}
  aria-label="Paramètres"
>
  ⚙️
</button>
```

Et avant la fermeture du composant, ajouter le rendu du modal :
```tsx
<SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
```

**Note** : si MobileNavbar n'est pas le bon emplacement (par exemple si le HUD desktop est ailleurs), placer le bouton dans le HUD principal de la `MapPage.tsx` ou d'un autre composant approprié. Vérifier visuellement l'emplacement le plus accessible.

- [ ] **Step 4 : Tester in-browser**

```bash
cd "apps/explore-web" && pnpm dev
```

Ouvrir l'app, cliquer le bouton ⚙️, vérifier que le SettingsModal s'ouvre, que le toggle reflète la valeur DB (true par défaut), et que le toggle peut être basculé (vérifier en DB que la valeur change).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/map/MobileNavbar.tsx
git commit -m "feat(v0.7+): bouton ⚙️ Paramètres dans la navbar — ouvre SettingsModal"
```

---

## Task 6 — Intégration dans `usePresence.ts`

**Files:**
- Modify: `apps/explore-web/src/hooks/usePresence.ts`
- Modify: `apps/explore-web/src/stores/playerStore.ts` (ajout d'un flag local)

- [ ] **Step 1 : Ajouter `brouillerPistes` au playerStore**

Modifier `apps/explore-web/src/stores/playerStore.ts`. Ajouter dans l'interface `PlayerState` :

```typescript
/** V0.7+ Brouillage GPS — toggle local synchronisé via useUserSettings */
brouillerPistes: boolean
setBrouillerPistes: (value: boolean) => void

/** V0.7+ Brouillage GPS — position publique floutée mémorisée pour la session
 *  (recalculée seulement au login ou au toggle change). Null si toggle off. */
publicPosition: { lng: number; lat: number } | null
setPublicPosition: (pos: { lng: number; lat: number } | null) => void
```

Et dans le `create<PlayerState>(...)` :

```typescript
brouillerPistes: true,  // privacy-by-default
setBrouillerPistes: (value) => set({ brouillerPistes: value }),
publicPosition: null,
setPublicPosition: (pos) => set({ publicPosition: pos }),
```

- [ ] **Step 2 : Synchroniser le toggle entre useUserSettings et playerStore**

Modifier `apps/explore-web/src/hooks/useUserSettings.ts` pour aussi mettre à jour le store :

```typescript
import { usePlayerStore } from '../stores/playerStore'

// Dans le hook, après le fetch initial et après le set :
const setStoreBrouiller = usePlayerStore(s => s.setBrouillerPistes)
const setStorePublicPos = usePlayerStore(s => s.setPublicPosition)

// Dans fetchSettings, après le setSettings :
if (!cancelled && data) {
  const value = (data as { brouiller_pistes: boolean }).brouiller_pistes
  setStoreBrouiller(value)
}

// Dans setBrouillerPistes, après le succès du RPC :
setStoreBrouiller(value)
// Invalider la position publique pour forcer un nouveau tirage
setStorePublicPos(null)
```

- [ ] **Step 3 : Modifier `usePresence.ts` pour calculer la position publique floutée**

Modifier `buildPayload()` pour utiliser la position publique au lieu de `userPosition` quand le brouillage est on. Ajouter une fonction helper et appeler la RPC `randomize_position_on_land` une fois par session (ou quand le toggle change).

```typescript
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

// (… imports existants …)

async function ensurePublicPosition(realLat: number, realLng: number): Promise<{ lat: number; lng: number }> {
  const state = usePlayerStore.getState()
  if (!state.brouillerPistes) {
    return { lat: realLat, lng: realLng }
  }
  if (state.publicPosition) {
    return state.publicPosition
  }
  // Tirage initial : appel RPC
  const { data, error } = await supabase
    .rpc('randomize_position_on_land', { p_lat: realLat, p_lng: realLng })
    .single()
  if (error || !data) {
    // Fallback : on retourne la vraie position pour ne rien casser
    return { lat: realLat, lng: realLng }
  }
  const blurred = {
    lat: (data as { out_lat: number }).out_lat,
    lng: (data as { out_lng: number }).out_lng,
  }
  state.setPublicPosition(blurred)
  return blurred
}
```

Puis dans `buildPayload` (qui devient `async` ou utilise une wrapped version) :

**Important** : `channel.track()` accepte une promise, donc on peut faire `buildPayload` async. Modifier les 2 sites d'appel (initial subscribe et interval) en conséquence.

```typescript
async function buildPayload(): Promise<PresencePayload> {
  const state = usePlayerStore.getState()
  const pos = state.userPosition  // toujours la vraie position GPS pour soi
  let publicLat: number | null = null
  let publicLng: number | null = null
  if (pos) {
    const pub = await ensurePublicPosition(pos.lat, pos.lng)
    publicLat = pub.lat
    publicLng = pub.lng
  }
  return {
    userId: userId!,
    name: state.userName || 'Quelqu\'un',
    factionColor: state.userFactionColor,
    factionPattern: state.userFactionPattern,
    avatarUrl: state.userAvatarUrl,
    displayedTitles: state.displayedTitles,
    lat: publicLat,   // position floutée (ou réelle si toggle off) — visible aux autres
    lng: publicLng,
  }
}
```

Et adapter les 2 appels :
```typescript
// Dans .subscribe :
.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track(await buildPayload())
  }
})

// Dans setInterval :
intervalRef.current = setInterval(async () => {
  if (channel.state === 'joined') {
    await channel.track(await buildPayload())
  }
}, TRACK_INTERVAL_MS)
```

- [ ] **Step 4 : Tester in-browser**

```bash
cd "apps/explore-web" && pnpm dev
```

Test 1 — Brouillage activé (défaut) :
- Ouvrir l'app, autoriser GPS
- Vérifier dans DevTools Network que `randomize_position_on_land` est appelée 1x
- Ouvrir un 2e navigateur (incognito) avec un autre compte
- Vérifier que sur le 2e navigateur, le 1er joueur apparaît à une position **différente** de la vraie position GPS (dans un rayon de 50 km)
- Vérifier que sur le 1er navigateur, **mon avatar reste à ma vraie position** GPS

Test 2 — Toggle off :
- Ouvrir Paramètres → désactiver "Brouiller mes pistes"
- Vérifier que sur le 2e navigateur, le 1er joueur apparaît à sa vraie position GPS

Test 3 — Re-toggle on :
- Réactiver le toggle
- Vérifier qu'un **nouveau** tirage est fait (position différente du 1er tirage)

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/hooks/usePresence.ts apps/explore-web/src/hooks/useUserSettings.ts apps/explore-web/src/stores/playerStore.ts
git commit -m "feat(v0.7+): brouillage GPS — position publique floutée pour les autres, vraie pour soi

- usePresence calcule la position publique via randomize_position_on_land
- Position floutée mémorisée dans playerStore.publicPosition (1× par session ou par toggle change)
- Asymétrie soi/autres : usePlayerStore.userPosition reste la vraie position locale"
```

---

## Task 7 — Validation finale, déploiement et import landmasses prod

**Files:**
- Aucun nouveau fichier

- [ ] **Step 1 : Lint + build local**

```bash
cd "apps/explore-web" && pnpm build
```

Expected : build OK sans erreur TypeScript ni warning bloquant.

- [ ] **Step 2 : Push de la migration en prod**

```bash
cd "apps/explore-web" && pnpm dlx supabase db push --linked
```

Expected : migration `054_v07_brouillage_gps.sql` appliquée en prod.

- [ ] **Step 3 : Lancer le script d'import en prod**

```bash
SUPABASE_URL="https://<prod-project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE="<prod-service-role-key>" \
pnpm tsx scripts/import-landmasses.ts
```

Expected : `Done. ~127 landmasses in table.` Vérifier dans Supabase Studio (prod) que la table `landmasses` est bien remplie.

- [ ] **Step 4 : Test PostGIS en prod**

Via Supabase Studio (prod) → SQL Editor :
```sql
SELECT is_on_land(48.8566, 2.3522);
SELECT * FROM randomize_position_on_land(48.8566, 2.3522);
```

Expected : true / paire (lat, lng) sur terre dans 50 km de Paris.

- [ ] **Step 5 : Deploy frontend en prod (Netlify, manuel)**

```bash
cd "apps/explore-web" && netlify deploy --prod --dir "$PWD/dist" --no-build
```

Expected : déploiement OK, URL prod accessible.

- [ ] **Step 6 : Smoke test en prod**

- Ouvrir `https://carte.runesdechene.com` (ou `https://app.runesdechene.com`)
- Se connecter, vérifier que :
  - Le bouton ⚙️ Paramètres est visible
  - Le toggle "Brouiller mes pistes" est ON par défaut
  - On voit sa propre position correctement
- Ouvrir un 2e device/navigateur avec un compte différent
- Vérifier la même asymétrie qu'en local

- [ ] **Step 7 : Commit éventuel des ajustements + push final**

Si des bugs sont détectés en prod, les fixer puis :
```bash
git add <fichiers modifiés>
git commit -m "fix(v0.7+): <correction>"
git push
```

- [ ] **Step 8 : Mettre à jour le CHANGELOG explore-web**

Ajouter une entrée dans `apps/explore-web/CHANGELOG.md` :

```markdown
## V0.7+ — Brouillage GPS

- ⚙️ Nouveau bouton **Paramètres** dans la navbar
- 🌫️ Toggle **Brouiller mes pistes** (activé par défaut) — ta position affichée aux autres voyageurs est aléatoire dans 50 km. Toi, tu vois toujours ta vraie position.
- Migration SQL `054_v07_brouillage_gps.sql` + import dataset Natural Earth landmasses
```

```bash
git add apps/explore-web/CHANGELOG.md
git commit -m "docs(v0.7+): changelog brouillage GPS"
git push
```

---

## Récapitulatif

**Effort total estimé** : ~1.5 jour

| Task | Effort | Sortie |
|---|---|---|
| Task 1 — Migration SQL | ~3h | `054_v07_brouillage_gps.sql` + dataset |
| Task 2 — Script import | ~1h | `scripts/import-landmasses.ts`, landmasses peuplées en local |
| Task 3 — Hook useUserSettings | ~1h | hook fonctionnel |
| Task 4 — SettingsModal | ~1.5h | composant + CSS |
| Task 5 — Bouton navbar | ~30min | bouton ⚙️ ouvre le modal |
| Task 6 — Intégration usePresence | ~2h | brouillage actif end-to-end |
| Task 7 — Deploy prod + smoke test | ~2h | feature live en prod |

**Risques connus** :

- Le dataset Natural Earth peut avoir des frontières imprécises près des côtes — un point généré juste sur la côte peut être considéré "pas sur terre" alors qu'il l'est. Acceptable : le retry rattrapera dans la grande majorité des cas, et le fallback assure qu'on retourne toujours quelque chose.
- Si l'extension PostGIS n'est pas activée en prod Supabase, `db push` échouera. Activer manuellement via Studio.
- Le script d'import nécessite la SERVICE_ROLE key — la garder secrète, ne pas la committer en clair.

**Conditions de "DONE"** :

- ✅ Migration appliquée en prod
- ✅ landmasses peuplée en prod (~127 rows)
- ✅ Toggle ⚙️ visible et fonctionnel sur l'app prod
- ✅ Asymétrie vérifiée : sur 2 comptes différents, l'un voit l'autre à une position différente de la sienne propre
