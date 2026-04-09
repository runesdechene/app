# Champ Époque sur les Lieux — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un champ "Époque" (période historique + date précise optionnelle) sur les lieux, avec 3 référentiels calendaires (Grégorien, Fondation de Rome, Chute de Constantinople).

**Architecture:** Table `eras` de référence (11 périodes), deux colonnes sur `places` (`era_id` FK nullable, `year_exact` INTEGER nullable). Conversion calendaire purement front-end. Réglage de référentiel dans le menu avatar (localStorage).

**Tech Stack:** PostgreSQL (Supabase), React 18, TypeScript strict, Zustand, CSS composant

**Spec:** `docs/superpowers/specs/2026-04-09-epoque-lieu-design.md`

---

## File Map

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| Create | `supabase/migrations/073_eras_table_and_place_columns.sql` | Table `eras`, colonnes sur `places`, mise à jour RPC `create_place` |
| Create | `apps/explore-web/src/lib/calendarUtils.ts` | Fonctions de conversion calendrier + formatage |
| Create | `apps/explore-web/src/hooks/useCalendarRef.ts` | Hook localStorage pour le référentiel choisi par le lecteur |
| Create | `apps/explore-web/src/components/places/EraSelector.tsx` | Composant réutilisable : dropdown époque + date précise + référentiel |
| Create | `apps/explore-web/src/components/places/EraSelector.css` | Styles du sélecteur d'époque |
| Modify | `apps/explore-web/src/components/places/AddPlaceFlow.tsx` | Intégrer EraSelector dans Step 2 + envoyer era_id/year_exact au RPC |
| Modify | `apps/explore-web/src/hooks/usePlace.ts` | Ajouter `eraId`, `eraName`, `yearExact` au type PlaceDetail |
| Modify | `apps/explore-web/src/components/places/PlaceInfos.tsx` | Ajouter la ligne Époque (affichage + ajout collaboratif) |
| Modify | `apps/explore-web/src/components/places/PlaceInfos.css` | Styles pour la ligne époque |
| Modify | `apps/explore-web/src/components/auth/ProfileMenu.tsx` | Switch référentiel calendaire dans le menu avatar |

---

### Task 1: Migration SQL — table `eras` + colonnes `places` + RPC

**Files:**
- Create: `supabase/migrations/073_eras_table_and_place_columns.sql`

- [ ] **Step 1: Écrire la migration SQL**

```sql
-- 073 : Table eras + colonnes era_id/year_exact sur places + mise à jour create_place

-- Table de référence des époques
CREATE TABLE IF NOT EXISTS public.eras (
  id         VARCHAR PRIMARY KEY,
  name       VARCHAR NOT NULL,
  year_start INTEGER,
  year_end   INTEGER,
  sort_order SMALLINT NOT NULL
);

-- Données de référence
INSERT INTO public.eras (id, name, year_start, year_end, sort_order) VALUES
  ('prehistory',          'Préhistoire',            NULL,  -3300, 1),
  ('bronze-age',          'Âge du Bronze',          -3300, -1200, 2),
  ('iron-age',            'Âge du Fer',             -1200, -500,  3),
  ('classical-antiquity', 'Antiquité classique',    -500,  476,   4),
  ('early-middle-ages',   'Haut Moyen Âge',         476,   1000,  5),
  ('late-middle-ages',    'Bas Moyen Âge',          1000,  1453,  6),
  ('renaissance',         'Renaissance',            1453,  1600,  7),
  ('early-modern',        'Époque moderne',         1600,  1789,  8),
  ('contemporary',        'Époque contemporaine',   1789,  1945,  9),
  ('post-1945',           'Monde post-1945',        1945,  2020,  10),
  ('digital-era',         'Ère digitale',           2020,  NULL,  11);

-- RLS : lecture publique
ALTER TABLE public.eras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eras_read" ON public.eras FOR SELECT USING (true);

-- Colonnes sur places
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS era_id VARCHAR REFERENCES public.eras(id);
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS year_exact INTEGER;

-- Mise à jour de create_place pour accepter era_id et year_exact
CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id      TEXT,
  p_title        TEXT,
  p_latitude     REAL,
  p_longitude    REAL,
  p_tag_id       TEXT,
  p_image_url    TEXT DEFAULT NULL,
  p_thumb_url    TEXT DEFAULT NULL,
  p_address      TEXT DEFAULT '',
  p_text         TEXT DEFAULT '',
  p_user_lat     REAL DEFAULT NULL,
  p_user_lng     REAL DEFAULT NULL,
  p_carnet_title TEXT DEFAULT NULL,
  p_era_id       TEXT DEFAULT NULL,
  p_year_exact   INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id       TEXT;
  v_images       JSONB;
  v_tag          RECORD;
  v_is_gps       BOOLEAN := false;
  v_influence_gain INTEGER;
  v_content_pts  INTEGER := 0;
  v_user         RECORD;
  v_blob_id      TEXT;
  v_contrib_id   TEXT;
BEGIN
  -- Vérifier le tag
  SELECT id, title INTO v_tag FROM public.tags WHERE id = p_tag_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Tag introuvable');
  END IF;

  -- Vérifier l'utilisateur
  SELECT id, faction_id INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Utilisateur introuvable');
  END IF;

  -- Générer l'ID
  v_new_id := gen_random_uuid()::TEXT;

  -- Construire images JSONB
  IF p_image_url IS NOT NULL THEN
    v_images := jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::TEXT,
        'url', p_image_url,
        'thumb', COALESCE(p_thumb_url, p_image_url)
      )
    );
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insérer le lieu
  INSERT INTO public.places (id, title, latitude, longitude, author_id, place_type_id, address, images, era_id, year_exact)
  VALUES (v_new_id, p_title, p_latitude, p_longitude, p_user_id, 'lieu', p_address, v_images, p_era_id, p_year_exact);

  -- Tag principal
  INSERT INTO public.place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Découverte automatique
  INSERT INTO public.places_viewed (user_id, place_id)
  VALUES (p_user_id, v_new_id)
  ON CONFLICT DO NOTHING;

  -- GPS ?
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_is_gps := (
      acos(
        sin(radians(p_latitude)) * sin(radians(p_user_lat)) +
        cos(radians(p_latitude)) * cos(radians(p_user_lat)) *
        cos(radians(p_longitude - p_user_lng))
      ) * 6371000
    ) <= 200;
  END IF;

  -- Influence permanente (stock)
  v_influence_gain := 50;
  UPDATE public.places
  SET influence_stock = v_influence_gain
  WHERE id = v_new_id;

  -- Points d'exploration
  INSERT INTO public.exploration_log (user_id, place_id, points, source)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 15 ELSE 5 END, 'create');

  -- Blob & influence faction
  IF v_user.faction_id IS NOT NULL THEN
    SELECT b.id INTO v_blob_id
    FROM public.blobs b
    JOIN public.blob_places bp ON bp.blob_id = b.id
    WHERE bp.place_id = v_new_id
    LIMIT 1;

    INSERT INTO public.place_influence (place_id, faction_id, points, source)
    VALUES (v_new_id, v_user.faction_id, v_influence_gain, 'permanent')
    ON CONFLICT (place_id, faction_id) DO UPDATE
    SET points = place_influence.points + v_influence_gain;
  END IF;

  -- Contribution carnet
  IF p_text IS NOT NULL AND p_text != '' THEN
    v_contrib_id := gen_random_uuid()::TEXT;
    v_content_pts := 10;

    INSERT INTO public.contributions (id, place_id, user_id, faction_id, type, content, image_url)
    VALUES (
      v_contrib_id, v_new_id, p_user_id, v_user.faction_id,
      'carnet',
      CASE WHEN p_carnet_title IS NOT NULL AND p_carnet_title != ''
        THEN p_carnet_title || E'\n' || p_text
        ELSE p_text
      END,
      p_image_url
    );

    -- Bonus si images
    IF p_image_url IS NOT NULL THEN
      v_content_pts := v_content_pts + 10;
    END IF;

    -- Points érudition
    INSERT INTO public.exploration_log (user_id, place_id, points, source)
    VALUES (p_user_id, v_new_id, v_content_pts, 'content');
  END IF;

  -- Activity log
  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('place_created', p_user_id, v_new_id, v_user.faction_id,
    jsonb_build_object('title', p_title, 'tag', v_tag.title));

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'isGps', v_is_gps,
    'rewards', json_build_object(
      'permanentInfluence', v_influence_gain,
      'explorationGain', CASE WHEN v_is_gps THEN 15 ELSE 5 END,
      'contentPoints', v_content_pts,
      'isExplorer', v_is_gps
    )
  );
END;
$$;
```

- [ ] **Step 2: Appliquer la migration**

Run: `npx supabase db query --linked -f supabase/migrations/073_eras_table_and_place_columns.sql`
Expected: Pas d'erreur. Table `eras` créée avec 11 lignes, colonnes ajoutées sur `places`, RPC mise à jour.

- [ ] **Step 3: Vérifier la migration**

Run: `npx supabase db query --linked -c "SELECT count(*) FROM eras; SELECT column_name FROM information_schema.columns WHERE table_name = 'places' AND column_name IN ('era_id', 'year_exact');"`
Expected: count = 11, deux lignes (era_id, year_exact)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/073_eras_table_and_place_columns.sql
git commit -m "feat: migration 073 — table eras + colonnes era_id/year_exact sur places"
```

---

### Task 2: Utilitaires calendrier + hook référentiel

**Files:**
- Create: `apps/explore-web/src/lib/calendarUtils.ts`
- Create: `apps/explore-web/src/hooks/useCalendarRef.ts`

- [ ] **Step 1: Créer calendarUtils.ts**

```typescript
export type CalendarRef = 'gregorian' | 'auc' | 'constantinople'

export const CALENDAR_LABELS: Record<CalendarRef, string> = {
  gregorian: 'Grégorien',
  auc: 'Fondation de Rome (AUC)',
  constantinople: 'Chute de Constantinople',
}

/** Convertit une année Grégorienne vers le référentiel cible */
export function toCalendar(gregorianYear: number, ref: CalendarRef): number {
  switch (ref) {
    case 'auc': return gregorianYear + 753
    case 'constantinople': return gregorianYear - 1453
    default: return gregorianYear
  }
}

/** Convertit une année d'un référentiel vers Grégorien (pour stockage) */
export function toGregorian(year: number, ref: CalendarRef): number {
  switch (ref) {
    case 'auc': return year - 753
    case 'constantinople': return year + 1453
    default: return year
  }
}

/** Formate une année pour affichage (ex: "52 ap. J.-C.", "-500" → "500 av. J.-C.") */
export function formatYear(gregorianYear: number, ref: CalendarRef): string {
  const converted = toCalendar(gregorianYear, ref)

  if (ref === 'auc') {
    return `${converted} AUC`
  }

  if (ref === 'constantinople') {
    if (converted < 0) return `${Math.abs(converted)} av. Chute`
    return `${converted} ap. Chute`
  }

  // Grégorien
  if (gregorianYear < 0) return `${Math.abs(gregorianYear)} av. J.-C.`
  return `${gregorianYear} ap. J.-C.`
}

/** Formate la fourchette d'une époque pour le dropdown */
export function formatEraRange(yearStart: number | null, yearEnd: number | null): string {
  if (yearStart === null && yearEnd !== null) {
    return `avant ${yearEnd < 0 ? `${Math.abs(yearEnd)} av. J.-C.` : yearEnd}`
  }
  if (yearStart !== null && yearEnd === null) {
    return `${yearStart < 0 ? `${Math.abs(yearStart)} av. J.-C.` : yearStart} à aujourd'hui`
  }
  if (yearStart !== null && yearEnd !== null) {
    const startStr = yearStart < 0 ? `${Math.abs(yearStart)} av. J.-C.` : `${yearStart}`
    const endStr = yearEnd < 0 ? `${Math.abs(yearEnd)} av. J.-C.` : `${yearEnd}`
    return `${startStr} à ${endStr}`
  }
  return ''
}
```

- [ ] **Step 2: Créer useCalendarRef.ts**

```typescript
import { useState, useCallback } from 'react'
import type { CalendarRef } from '../lib/calendarUtils'

const STORAGE_KEY = 'calendar-ref'

function getStoredRef(): CalendarRef {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'auc' || stored === 'constantinople') return stored
  return 'gregorian'
}

export function useCalendarRef() {
  const [calendarRef, setCalendarRefState] = useState<CalendarRef>(getStoredRef)

  const setCalendarRef = useCallback((ref: CalendarRef) => {
    localStorage.setItem(STORAGE_KEY, ref)
    setCalendarRefState(ref)
  }, [])

  return { calendarRef, setCalendarRef }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/lib/calendarUtils.ts apps/explore-web/src/hooks/useCalendarRef.ts
git commit -m "feat: utilitaires conversion calendrier + hook useCalendarRef"
```

---

### Task 3: Composant EraSelector

**Files:**
- Create: `apps/explore-web/src/components/places/EraSelector.tsx`
- Create: `apps/explore-web/src/components/places/EraSelector.css`

- [ ] **Step 1: Créer EraSelector.tsx**

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  type CalendarRef,
  CALENDAR_LABELS,
  toGregorian,
  toCalendar,
  formatYear,
  formatEraRange,
} from '../../lib/calendarUtils'
import './EraSelector.css'

interface Era {
  id: string
  name: string
  year_start: number | null
  year_end: number | null
  sort_order: number
}

interface EraSelectorProps {
  eraId: string | null
  yearExact: number | null
  onChange: (eraId: string | null, yearExact: number | null) => void
  required?: boolean
}

export function EraSelector({ eraId, yearExact, onChange, required }: EraSelectorProps) {
  const [eras, setEras] = useState<Era[]>([])
  const [inputRef, setInputRef] = useState<CalendarRef>('gregorian')
  const [yearInput, setYearInput] = useState('')
  const [isBce, setIsBce] = useState(false)

  useEffect(() => {
    supabase
      .from('eras')
      .select('id, name, year_start, year_end, sort_order')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setEras(data)
      })
  }, [])

  // Sync yearInput when yearExact changes externally
  useEffect(() => {
    if (yearExact !== null) {
      const converted = toCalendar(yearExact, inputRef)
      setYearInput(Math.abs(converted).toString())
      setIsBce(inputRef === 'gregorian' && yearExact < 0)
    } else {
      setYearInput('')
      setIsBce(false)
    }
  }, [yearExact, inputRef])

  function handleYearChange(raw: string) {
    setYearInput(raw)
    if (!raw.trim()) {
      onChange(eraId, null)
      return
    }
    const num = parseInt(raw, 10)
    if (isNaN(num)) return

    let refYear = num
    if (inputRef === 'gregorian' && isBce) refYear = -num
    const gregorian = toGregorian(refYear, inputRef)
    onChange(eraId, gregorian)
  }

  function handleBceToggle(bce: boolean) {
    setIsBce(bce)
    if (!yearInput.trim()) return
    const num = parseInt(yearInput, 10)
    if (isNaN(num)) return
    const gregorian = bce ? -num : num
    onChange(eraId, gregorian)
  }

  function handleRefChange(ref: CalendarRef) {
    setInputRef(ref)
    // yearInput will be resynced by the useEffect above
  }

  // Validation : date dans la fourchette de l'époque ?
  const selectedEra = eras.find(e => e.id === eraId)
  const yearWarning = (() => {
    if (yearExact === null || !selectedEra) return null
    const { year_start, year_end } = selectedEra
    if (year_start !== null && yearExact < year_start) return 'Date antérieure à cette époque'
    if (year_end !== null && yearExact > year_end) return 'Date postérieure à cette époque'
    return null
  })()

  return (
    <div className="era-selector">
      {/* Dropdown époque */}
      <label className="era-label">
        Époque {required && <span className="era-required">*</span>}
      </label>
      <select
        className="era-dropdown"
        value={eraId ?? ''}
        onChange={e => onChange(e.target.value || null, yearExact)}
      >
        <option value="" disabled>Choisir une époque...</option>
        {eras.map(era => (
          <option key={era.id} value={era.id}>
            {era.name} — {formatEraRange(era.year_start, era.year_end)}
          </option>
        ))}
      </select>

      {/* Date précise (affiché après choix d'époque) */}
      {eraId && (
        <div className="era-date-section">
          <label className="era-label">
            Date précise <span className="era-optional">(optionnel)</span>
          </label>

          <div className="era-date-row">
            <input
              type="number"
              className="era-year-input"
              placeholder="Année"
              value={yearInput}
              onChange={e => handleYearChange(e.target.value)}
            />

            {/* Toggle av/ap J.-C. — masqué si AUC */}
            {inputRef === 'gregorian' && (
              <div className="era-bce-toggle">
                <button
                  type="button"
                  className={`era-bce-btn ${isBce ? 'active' : ''}`}
                  onClick={() => handleBceToggle(true)}
                >
                  av. J.-C.
                </button>
                <button
                  type="button"
                  className={`era-bce-btn ${!isBce ? 'active' : ''}`}
                  onClick={() => handleBceToggle(false)}
                >
                  ap. J.-C.
                </button>
              </div>
            )}
          </div>

          {/* Sélecteur référentiel */}
          <div className="era-ref-row">
            <span className="era-ref-label">Référentiel :</span>
            {(['gregorian', 'auc', 'constantinople'] as const).map(ref => (
              <button
                key={ref}
                type="button"
                className={`era-ref-btn ${inputRef === ref ? 'active' : ''}`}
                onClick={() => handleRefChange(ref)}
              >
                {CALENDAR_LABELS[ref]}
              </button>
            ))}
          </div>

          {/* Avertissement fourchette */}
          {yearWarning && (
            <p className="era-warning">{yearWarning}</p>
          )}

          {/* Équivalences */}
          {yearExact !== null && (
            <div className="era-equivalences">
              <span className="era-equiv-title">Équivalences</span>
              <div className="era-equiv-values">
                <span className="era-equiv-primary">
                  {formatYear(yearExact, 'gregorian')}
                </span>
                <span className="era-equiv-secondary">
                  {formatYear(yearExact, 'auc')}
                </span>
                <span className="era-equiv-secondary">
                  {formatYear(yearExact, 'constantinople')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Créer EraSelector.css**

```css
.era-selector {
  margin-top: 1rem;
}

.era-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

.era-required {
  color: var(--color-accent);
}

.era-optional {
  color: var(--color-text-muted);
  font-weight: 400;
  font-size: 0.85rem;
}

.era-dropdown {
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 0.95rem;
  appearance: none;
  cursor: pointer;
}

.era-date-section {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
}

.era-date-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.era-year-input {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 1.1rem;
  font-weight: 600;
}

.era-bce-toggle {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.era-bce-btn {
  padding: 0.6rem 0.8rem;
  background: var(--color-bg-input);
  color: var(--color-text-muted);
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
}

.era-bce-btn.active {
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: 600;
}

.era-ref-row {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex-wrap: wrap;
}

.era-ref-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-right: 0.5rem;
}

.era-ref-btn {
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 0.72rem;
}

.era-ref-btn.active {
  background: var(--color-accent);
  color: var(--color-bg);
  border-color: var(--color-accent);
  font-weight: 600;
}

.era-warning {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #e6a23c;
}

.era-equivalences {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.era-equiv-title {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.era-equiv-values {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.era-equiv-primary {
  color: var(--color-accent);
}

.era-equiv-secondary {
  color: var(--color-text-muted);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/EraSelector.tsx apps/explore-web/src/components/places/EraSelector.css
git commit -m "feat: composant EraSelector — dropdown époque + date précise + référentiels"
```

---

### Task 4: Intégrer EraSelector dans AddPlaceFlow

**Files:**
- Modify: `apps/explore-web/src/components/places/AddPlaceFlow.tsx`

- [ ] **Step 1: Ajouter les state variables**

Après les state existants (autour de la ligne 39), ajouter :

```typescript
const [eraId, setEraId] = useState<string | null>(null)
const [yearExact, setYearExact] = useState<number | null>(null)
```

- [ ] **Step 2: Ajouter l'import EraSelector**

En haut du fichier, ajouter :

```typescript
import { EraSelector } from './EraSelector'
```

- [ ] **Step 3: Ajouter EraSelector dans le formulaire Step 2**

Dans le rendu du Step 2, après la section des tags (autour de la ligne 373), insérer :

```tsx
<EraSelector
  eraId={eraId}
  yearExact={yearExact}
  onChange={(era, year) => { setEraId(era); setYearExact(year) }}
  required
/>
```

- [ ] **Step 4: Ajouter la validation époque dans handleSubmit**

Avant l'appel RPC (vers la ligne 290), ajouter la validation :

```typescript
if (!eraId) {
  alert('Veuillez choisir une époque')
  return
}
```

- [ ] **Step 5: Passer era_id et year_exact au RPC**

Dans l'appel `supabase.rpc('create_place', { ... })`, ajouter les deux paramètres :

```typescript
p_era_id: eraId,
p_year_exact: yearExact,
```

- [ ] **Step 6: Vérifier que le build passe**

Run: `cd apps/explore-web && pnpm build`
Expected: Build réussi sans erreur TypeScript

- [ ] **Step 7: Commit**

```bash
git add apps/explore-web/src/components/places/AddPlaceFlow.tsx
git commit -m "feat: intégrer EraSelector dans AddPlaceFlow — époque obligatoire à la création"
```

---

### Task 5: Afficher l'époque dans PlacePanel (onglet Infos)

**Files:**
- Modify: `apps/explore-web/src/hooks/usePlace.ts` (type PlaceDetail)
- Modify: `apps/explore-web/src/components/places/PlaceInfos.tsx`
- Modify: `apps/explore-web/src/components/places/PlaceInfos.css`
- Modify: `apps/explore-web/src/components/places/PlacePanel.tsx`

- [ ] **Step 1: Ajouter les champs au type PlaceDetail**

Dans `apps/explore-web/src/hooks/usePlace.ts`, ajouter dans l'interface `PlaceDetail` (autour de la ligne 50) :

```typescript
eraId: string | null
eraName: string | null
yearExact: number | null
```

- [ ] **Step 2: Mettre à jour la requête dans usePlace**

Dans le hook `usePlace`, la requête qui fetch le lieu doit inclure les nouvelles colonnes. Trouver le `select()` sur `places` et ajouter `era_id, year_exact, eras(name)` au select (avec un join implicite Supabase sur la FK). Mapper `era_id` → `eraId`, `eras.name` → `eraName`, `year_exact` → `yearExact`.

Si le lieu est chargé via un RPC (`get_place_detail_v05`), il faudra mettre à jour ce RPC dans une sous-migration ou ajouter un select séparé. Vérifier l'implémentation exacte de `usePlace` et adapter.

- [ ] **Step 3: Passer l'époque au PlaceInfos**

Dans `PlacePanel.tsx`, là où `<PlaceInfos>` est rendu (ligne ~814), ajouter les props :

```tsx
<PlaceInfos
  placeId={place.id}
  infos={infoFields}
  eraId={place.eraId}
  eraName={place.eraName}
  yearExact={place.yearExact}
  onRefresh={refreshV05}
/>
```

- [ ] **Step 4: Ajouter la ligne Époque dans PlaceInfos.tsx**

Modifier l'interface `PlaceInfosProps` :

```typescript
interface PlaceInfosProps {
  placeId: string
  infos: InfoField[]
  eraId: string | null
  eraName: string | null
  yearExact: number | null
  onRefresh: () => void
}
```

Ajouter un state pour le mode ajout et importer les utilitaires :

```typescript
import { useCalendarRef } from '../../hooks/useCalendarRef'
import { formatYear } from '../../lib/calendarUtils'
import { EraSelector } from './EraSelector'
```

Avant les InfoRow existants, ajouter la ligne Époque :

```tsx
export function PlaceInfos({ placeId, infos, eraId, eraName, yearExact, onRefresh }: PlaceInfosProps) {
  const userId = usePlayerStore(s => s.userId)
  const { calendarRef } = useCalendarRef()
  const [editingEra, setEditingEra] = useState(false)
  const [newEraId, setNewEraId] = useState<string | null>(null)
  const [newYearExact, setNewYearExact] = useState<number | null>(null)
  const [savingEra, setSavingEra] = useState(false)

  async function saveEra() {
    if (!newEraId || savingEra) return
    setSavingEra(true)
    const { error } = await supabase
      .from('places')
      .update({ era_id: newEraId, year_exact: newYearExact })
      .eq('id', placeId)
    if (!error) {
      setEditingEra(false)
      onRefresh()
    }
    setSavingEra(false)
  }

  return (
    <div className="place-infos">
      {/* Ligne Époque */}
      <div className="info-row">
        <div className="info-row-header">
          <span className="info-icon">🏛️</span>
          <span className="info-label">Époque</span>
          {!eraId && userId && !editingEra && (
            <button className="info-edit-btn" onClick={() => setEditingEra(true)}>
              Ajouter
            </button>
          )}
        </div>

        {editingEra ? (
          <div className="info-edit">
            <EraSelector
              eraId={newEraId}
              yearExact={newYearExact}
              onChange={(era, year) => { setNewEraId(era); setNewYearExact(year) }}
            />
            <div className="info-edit-actions">
              <button className="info-save-btn" onClick={saveEra} disabled={savingEra || !newEraId}>
                {savingEra ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button className="info-cancel-btn" onClick={() => setEditingEra(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : eraId && eraName ? (
          <div className="info-content">
            <p>
              {eraName}
              {yearExact !== null && (
                <span className="era-date-display"> — {formatYear(yearExact, calendarRef)}</span>
              )}
            </p>
          </div>
        ) : (
          <p className="info-empty">Aucune époque renseignée</p>
        )}
      </div>

      {/* InfoRows existants */}
      {(['accessibility', 'season', 'warning'] as const).map(type => {
        // ... code existant inchangé
      })}
    </div>
  )
}
```

- [ ] **Step 5: Vérifier le build**

Run: `cd apps/explore-web && pnpm build`
Expected: Build réussi

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/hooks/usePlace.ts apps/explore-web/src/components/places/PlaceInfos.tsx apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: afficher l'époque dans PlacePanel Infos + ajout collaboratif"
```

---

### Task 6: Switch référentiel dans le menu avatar

**Files:**
- Modify: `apps/explore-web/src/components/auth/ProfileMenu.tsx`

- [ ] **Step 1: Ajouter l'import et le hook**

En haut de `ProfileMenu.tsx` :

```typescript
import { useCalendarRef } from '../../hooks/useCalendarRef'
import { type CalendarRef, CALENDAR_LABELS } from '../../lib/calendarUtils'
```

Dans le composant, avant le `return` :

```typescript
const { calendarRef, setCalendarRef } = useCalendarRef()
```

- [ ] **Step 2: Ajouter le switch dans le dropdown**

Après le bouton "Changer mon email" (ligne 106) et avant le divider de déconnexion (ligne 108), insérer :

```tsx
<div className="profile-dropdown-divider" />

<div className="profile-dropdown-calendar">
  <span className="profile-dropdown-calendar-label">Référentiel calendaire</span>
  {(['gregorian', 'auc', 'constantinople'] as const).map(ref => (
    <button
      key={ref}
      className={`profile-dropdown-action calendar-ref-option ${calendarRef === ref ? 'active' : ''}`}
      onClick={() => setCalendarRef(ref)}
    >
      {calendarRef === ref && <span className="calendar-ref-check">✓</span>}
      {CALENDAR_LABELS[ref]}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Ajouter les styles CSS**

Dans le fichier CSS associé au ProfileMenu (ou inline si le composant n'a pas de CSS dédié), ajouter :

```css
.profile-dropdown-calendar-label {
  display: block;
  padding: 0.5rem 1rem;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.calendar-ref-option {
  position: relative;
  font-size: 0.85rem;
}

.calendar-ref-option.active {
  color: var(--color-accent);
}

.calendar-ref-check {
  margin-right: 0.5rem;
}
```

- [ ] **Step 4: Vérifier le build**

Run: `cd apps/explore-web && pnpm build`
Expected: Build réussi

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/auth/ProfileMenu.tsx
git commit -m "feat: switch référentiel calendaire dans le menu avatar"
```

---

### Task 7: Vérification finale et test manuel

- [ ] **Step 1: Build complet**

Run: `cd apps/explore-web && pnpm build`
Expected: Build réussi sans erreur ni warning TypeScript

- [ ] **Step 2: Test manuel — création de lieu**

Lancer `pnpm dev`, créer un lieu en testant :
- Sélection d'une époque (obligatoire — vérifier que le formulaire bloque sans)
- Saisie d'une date précise en Grégorien
- Basculer en AUC → vérifier que le champ se recalcule
- Basculer en Post-Chute → vérifier le calcul
- Vérifier le panneau Équivalences
- Soumettre → vérifier que le lieu est créé avec era_id et year_exact en base

- [ ] **Step 3: Test manuel — affichage PlacePanel**

- Ouvrir un lieu avec époque → vérifier l'affichage dans Infos
- Ouvrir un ancien lieu sans époque → vérifier le bouton "Ajouter" et le flow collaboratif
- Changer le référentiel dans le menu avatar → vérifier que la date s'adapte

- [ ] **Step 4: Commit final si ajustements**

```bash
git add -u
git commit -m "fix: ajustements post-test époque"
```
