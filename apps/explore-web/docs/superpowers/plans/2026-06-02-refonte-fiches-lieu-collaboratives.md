# Refonte fiches de lieu — carnet de route collaboratif · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les Récits individuels (1 carnet/user) par une fiche de lieu co-écrite : description collaborative wiki (historisée), discussion unifiée (commentaires texte/photos, likes, réponses 1 niveau), et photos découplées.

**Architecture:** Réutilisation maximale de `place_contributions` (nouveaux `type` : `description`, `comment` ; `photo` existe déjà) + une table d'historique `place_description_revisions`. Likes via `contribution_votes` existant. Toute la logique métier en RPC `SECURITY DEFINER`. Front React : PlacePanel réorganisé + nouveaux composants, style « carnet de route » (parchemin + manuscrit).

**Tech Stack:** Supabase (Postgres, migrations SQL numérotées, RPC plpgsql) · React 18 + Vite + TS strict · Zustand · CSS par composant (tokens `index.css`).

**Spec :** `apps/explore-web/docs/superpowers/specs/2026-06-02-refonte-fiches-lieu-collaboratives-design.md`

**⚠️ Pas de harness de tests dans ce repo.** Vérification = `pnpm build` (tsc strict), smoke-checks SQL (`mcp__plugin_supabase_supabase__execute_sql` ou `npx supabase`), et contrôle visuel de la fiche. Migrations appliquées via le workflow habituel (`docs/db/migrations-workflow.md`). Commits fréquents, conventional commits.

**Schéma réel vérifié (ne pas redeviner) :**
- `place_contributions(id serial PK, place_id varchar, user_id varchar, faction_id varchar?, type text, content text?, image_url text?, rating smallint?, votes_up int, votes_down int, created_at, updated_at, images jsonb='[]', title text?)`
- CHECK `place_contributions_type_check`: type ∈ `['carnet','photo','accessibility','season','warning','epoch']`
- UNIQUE `place_contributions_place_id_user_id_type_key (place_id, user_id, type)`
- `contribution_votes(id, contribution_id int, user_id varchar, vote smallint ∈{-1,1})`
- Notes ★ : table **`place_ratings(place_id, user_id, rating)`** (déjà séparée — RIEN à migrer côté notes)
- Découverte d'un lieu : `places_discovered(user_id, place_id, method)` ; auteur du lieu = ligne `method='author'`
- `get_place_detail_v05(p_place_id text, p_user_id text) → json` : voir `supabase/migrations/085_hotfix_get_place_detail_v05.sql`
- Front lit la RPC dans `PlacePanel.tsx` (`v05.contributions`, filtrées par `type`)

**Prochaines migrations libres : 195, 196, 197.**

---

## File Structure

**SQL (nouveaux fichiers, `supabase/migrations/`)**
- `195_carnet_collab_schema.sql` — CHECK étendu, `parent_id`, unicité partielle, table `place_description_revisions`.
- `196_carnet_collab_rpcs.sql` — RPCs `edit_place_description`, `restore_place_description_revision`, `add_place_comment`, `add_place_photos`, `get_place_description_history` + extension `get_place_detail_v05`.
- `197_carnet_collab_migrate_data.sql` — carnets existants → description (seed) + commentaires.

**Front (`apps/explore-web/src/`)**
- Créer `components/places/details/PlaceDescription.tsx` (+ `.css`) — encart manuscrit + édition + lien historique.
- Créer `components/places/modals/DescriptionEditModal.tsx` — édition wiki (réservée découvreurs).
- Créer `components/places/modals/DescriptionHistoryModal.tsx` — historique + restauration.
- Créer `components/places/discussion/DiscussionThread.tsx` — fil + composer.
- Créer `components/places/discussion/CommentCard.tsx` (+ `.css`) — commentaire (texte/photos/❤/réponse).
- Créer `components/places/discussion/CommentComposer.tsx` — composer unifié (texte et/ou photos).
- Créer `components/places/modals/AddPhotoModal.tsx` — upload photo seule.
- Créer `components/places/views/PhotoSlideshow.tsx` (+ `.css`) — bandeau sous le hero.
- Créer `components/places/details/CourtFold.tsx` (+ `.css`) — wrapper repliable de `PlaceCourtView`.
- Modifier `components/places/views/PlacePanel.tsx` — anatomie, onglets, défaut Discussion, Cour repliée.
- Modifier `components/places/views/PlacePanel.css` — fond parchemin.
- Modifier `components/places/views/PlaceGallery.tsx` — grille depuis galerie agrégée.
- Modifier `types/placeDetail.ts` — `V05Detail` (+ `description`), `V05Contribution` (+ `parentId`), `PlacePanelActiveTab`.
- Supprimer `components/places/cards/CarnetCard.tsx` (+ `.css`), `components/places/modals/AddCarnetModal.tsx` (+ `.css`).
- Copier la texture : déjà présente `src/assets/parchemin.png` (réutiliser via import).

---

## PHASE A — Fondations SQL

### Task A1 : Migration schéma (195)

**Files:**
- Create: `supabase/migrations/195_carnet_collab_schema.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 195_carnet_collab_schema.sql
-- WHY : refonte fiches de lieu — la description collaborative et les commentaires
-- réutilisent place_contributions (nouveaux types 'description'/'comment'), avec
-- réponses 1 niveau (parent_id) et historique d'édition (place_description_revisions).
-- Spec : docs/superpowers/specs/2026-06-02-refonte-fiches-lieu-collaboratives-design.md

BEGIN;

-- 1) Étendre le CHECK de type
ALTER TABLE public.place_contributions DROP CONSTRAINT IF EXISTS place_contributions_type_check;
ALTER TABLE public.place_contributions ADD CONSTRAINT place_contributions_type_check
  CHECK (type = ANY (ARRAY[
    'carnet','photo','accessibility','season','warning','epoch','comment','description'
  ]::text[]));

-- 2) parent_id : réponses à 1 niveau (FK auto-référente)
ALTER TABLE public.place_contributions
  ADD COLUMN IF NOT EXISTS parent_id integer
  REFERENCES public.place_contributions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_place_contributions_parent ON public.place_contributions(parent_id);
CREATE INDEX IF NOT EXISTS idx_place_contributions_place_type ON public.place_contributions(place_id, type);

-- 3) Remplacer l'unicité globale (place_id,user_id,type) — bloquait plusieurs
--    commentaires/photos par user — par des index partiels ciblés.
ALTER TABLE public.place_contributions
  DROP CONSTRAINT IF EXISTS place_contributions_place_id_user_id_type_key;

-- single-instance par user : infos
CREATE UNIQUE INDEX IF NOT EXISTS uq_pc_singleton_user_info
  ON public.place_contributions(place_id, user_id, type)
  WHERE type IN ('accessibility','season','warning','epoch','carnet');

-- single-instance par lieu : description (1 description par lieu)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pc_description_per_place
  ON public.place_contributions(place_id)
  WHERE type = 'description';

-- 'comment' et 'photo' : aucune contrainte (multiples autorisés).

-- 4) Historique d'édition de la description
CREATE TABLE IF NOT EXISTS public.place_description_revisions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id    varchar(255) NOT NULL,
  content     text NOT NULL,
  edited_by   varchar(255) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdr_place_created
  ON public.place_description_revisions(place_id, created_at DESC);

ALTER TABLE public.place_description_revisions OWNER TO postgres;
ALTER TABLE public.place_description_revisions ENABLE ROW LEVEL SECURITY;
-- Lecture publique (historique consultable), écriture uniquement via RPC SECURITY DEFINER.
DROP POLICY IF EXISTS pdr_read ON public.place_description_revisions;
CREATE POLICY pdr_read ON public.place_description_revisions FOR SELECT USING (true);
GRANT SELECT ON public.place_description_revisions TO authenticated, anon, service_role;

COMMIT;
```

- [ ] **Step 2 : Appliquer + smoke-check**

Appliquer la migration (workflow `docs/db/migrations-workflow.md`). Puis vérifier via `execute_sql` :

```sql
-- attendu : la contrainte unique globale n'existe plus, les 2 index partiels existent
SELECT indexname FROM pg_indexes
WHERE tablename = 'place_contributions'
  AND indexname IN ('uq_pc_singleton_user_info','uq_pc_description_per_place');
-- attendu : 2 lignes
SELECT to_regclass('public.place_description_revisions') IS NOT NULL AS ok;
-- attendu : ok = true
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/195_carnet_collab_schema.sql
git commit -m "feat(db): schema fiches collaboratives — types comment/description, parent_id, historique"
```

### Task A2 : RPCs description + commentaires + photos (196)

**Files:**
- Create: `supabase/migrations/196_carnet_collab_rpcs.sql`

- [ ] **Step 1 : Écrire la migration RPC**

```sql
-- 196_carnet_collab_rpcs.sql
-- WHY : logique métier de la fiche collaborative (SECURITY DEFINER).
-- Aucune récompense (Gloire/influence) — contribuer est un geste gratuit (décision Uriel 2026-06-02).

BEGIN;

-- Helper interne : l'utilisateur a-t-il découvert le lieu ?
CREATE OR REPLACE FUNCTION public._has_discovered(p_user_id text, p_place_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id);
$$;

-- ÉDITION DE LA DESCRIPTION (wiki ouvert, réservé découvreurs) -------------------
CREATE OR REPLACE FUNCTION public.edit_place_description(
  p_user_id text, p_place_id text, p_content text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
BEGIN
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;
  IF NOT public._has_discovered(p_user_id, p_place_id) THEN
    RETURN json_build_object('error','not_discovered');
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;

  -- upsert la ligne description (unicité partielle par lieu)
  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'description', v_content, now(), now())
  ON CONFLICT (place_id) WHERE (type = 'description')
  DO UPDATE SET content = EXCLUDED.content, user_id = EXCLUDED.user_id,
               faction_id = EXCLUDED.faction_id, updated_at = now();

  -- empiler une révision (jamais d'écrasement)
  INSERT INTO place_description_revisions (place_id, content, edited_by)
  VALUES (p_place_id, v_content, p_user_id);

  RETURN json_build_object('success', true, 'content', v_content);
END; $$;

-- RESTAURATION D'UNE RÉVISION ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_place_description_revision(
  p_user_id text, p_place_id text, p_revision_id bigint
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_content text;
BEGIN
  IF NOT public._has_discovered(p_user_id, p_place_id) THEN
    RETURN json_build_object('error','not_discovered');
  END IF;
  SELECT content INTO v_content FROM place_description_revisions
  WHERE id = p_revision_id AND place_id = p_place_id;
  IF v_content IS NULL THEN RETURN json_build_object('error','revision_not_found'); END IF;
  RETURN public.edit_place_description(p_user_id, p_place_id, v_content);
END; $$;

-- HISTORIQUE ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_description_history(p_place_id text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'id', r.id, 'content', r.content, 'createdAt', r.created_at,
    'editedBy', r.edited_by, 'editorName', u.first_name, 'editorAvatar', u.avatar_url
  ) ORDER BY r.created_at DESC), '[]'::json)
  FROM place_description_revisions r
  LEFT JOIN users u ON u.id = r.edited_by
  WHERE r.place_id = p_place_id;
$$;

-- AJOUT D'UN COMMENTAIRE (texte +/- photos ; réponses 1 niveau) ------------------
CREATE OR REPLACE FUNCTION public.add_place_comment(
  p_user_id text, p_place_id text, p_content text,
  p_images jsonb DEFAULT '[]'::jsonb, p_parent_id integer DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_parent_parent integer;
  v_id integer;
BEGIN
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT parent_id INTO v_parent_parent FROM place_contributions
    WHERE id = p_parent_id AND place_id = p_place_id AND type = 'comment';
    IF NOT FOUND THEN RETURN json_build_object('error','parent_not_found'); END IF;
    -- 1 seul niveau : on raccroche au commentaire racine
    IF v_parent_parent IS NOT NULL THEN p_parent_id := v_parent_parent; END IF;
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, parent_id, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'comment', v_content, COALESCE(p_images,'[]'::jsonb), p_parent_id, now(), now())
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'id', v_id);
END; $$;

-- AJOUT DE PHOTO(S) SANS TEXTE ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_place_photos(
  p_user_id text, p_place_id text, p_images jsonb
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_faction text; v_id integer;
BEGIN
  IF p_images IS NULL OR jsonb_array_length(p_images) = 0 THEN
    RETURN json_build_object('error','no_images');
  END IF;
  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;
  INSERT INTO place_contributions (place_id, user_id, faction_id, type, images, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'photo', p_images, now(), now())
  RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'id', v_id);
END; $$;

GRANT EXECUTE ON FUNCTION
  public.edit_place_description(text,text,text),
  public.restore_place_description_revision(text,text,bigint),
  public.get_place_description_history(text),
  public.add_place_comment(text,text,text,jsonb,integer),
  public.add_place_photos(text,text,jsonb),
  public._has_discovered(text,text)
  TO authenticated, service_role;

COMMIT;
```

- [ ] **Step 2 : Étendre `get_place_detail_v05` (même fichier, avant le COMMIT)**

Reprendre l'intégralité du corps de `085_hotfix_get_place_detail_v05.sql` et le réécrire avec :
- ajout d'un bloc **description** (la ligne `type='description'`) + son nombre de révisions + `likedByMe` ;
- ajout de `'parentId', pc.parent_id` dans l'objet de chaque contribution ;
- ajout `'likedByMe'` par contribution (sous-requête `contribution_votes`).

Insérer ce bloc **avant `RETURN json_build_object(`** :

```sql
  -- Description collaborative courante (+ nb révisions + like de l'utilisateur)
  DECLARE
    v_description JSON;
  BEGIN
    SELECT json_build_object(
      'id', d.id, 'content', d.content, 'updatedAt', d.updated_at,
      'editedBy', d.user_id, 'editorName', u.first_name, 'editorAvatar', u.avatar_url,
      'votesUp', d.votes_up,
      'revisionCount', (SELECT count(*) FROM place_description_revisions r WHERE r.place_id = p_place_id),
      'likedByMe', CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS(
        SELECT 1 FROM contribution_votes cv WHERE cv.contribution_id = d.id AND cv.user_id = p_user_id AND cv.vote = 1) END
    ) INTO v_description
    FROM place_contributions d JOIN users u ON u.id = d.user_id
    WHERE d.place_id = p_place_id AND d.type = 'description';
  END;
```

Modifier l'agrégat `v_contributions` pour ajouter deux champs dans `json_build_object(...)` :

```sql
      'parentId', pc.parent_id,
      'likedByMe', CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS(
        SELECT 1 FROM contribution_votes cv WHERE cv.contribution_id = pc.id AND cv.user_id = p_user_id AND cv.vote = 1) END,
```

Et ajouter dans le `RETURN json_build_object(...)` final la clé :

```sql
    'description', v_description,
```

(Garder tout le reste à l'identique : explorers, avgRating, ratingCount, userRating, isWishlisted, isExplorer, guardian, influence, dominantFaction.)

- [ ] **Step 3 : Appliquer + smoke-check**

```sql
-- description vide au départ sur un lieu donné → 'description' = null, pas d'erreur
SELECT (get_place_detail_v05('<un_place_id>', NULL)::json -> 'description');
-- édition par un découvreur connu
SELECT edit_place_description('<user_decouvreur>','<place_id>','Texte de test.');
-- attendu : {"success":true,...} ; puis description non-null + 1 révision
SELECT get_place_description_history('<place_id>');
```

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/196_carnet_collab_rpcs.sql
git commit -m "feat(db): RPCs description collaborative + commentaires + photos (sans récompense)"
```

---

## PHASE B — Migration des données

### Task B1 : Carnets existants → description (seed) + commentaires (197)

**Files:**
- Create: `supabase/migrations/197_carnet_collab_migrate_data.sql`

Règle de seed (spec §7) : description v1 = carnet de l'**auteur** du lieu (`places_discovered.method='author'`), sinon le carnet **le plus aimé** (`votes_up` max). Le carnet-seed devient la `description` (non dupliqué en commentaire) ; les autres carnets deviennent des `comment`.

- [ ] **Step 1 : Écrire la migration de données**

```sql
-- 197_carnet_collab_migrate_data.sql
-- WHY : convertir les carnets V0.5 vers le modèle collaboratif.
-- Idempotence : ne s'exécute que s'il reste des lignes type='carnet'.

BEGIN;

-- 1) Pour chaque lieu ayant des carnets, choisir le carnet-seed.
WITH authored AS (
  SELECT pd.place_id, pd.user_id AS author_id
  FROM places_discovered pd WHERE pd.method = 'author'
),
ranked AS (
  SELECT pc.id, pc.place_id, pc.user_id, pc.content, pc.created_at,
         ROW_NUMBER() OVER (
           PARTITION BY pc.place_id
           ORDER BY (CASE WHEN a.author_id = pc.user_id THEN 0 ELSE 1 END),
                    pc.votes_up DESC, pc.created_at ASC
         ) AS rn
  FROM place_contributions pc
  LEFT JOIN authored a ON a.place_id = pc.place_id
  WHERE pc.type = 'carnet'
)
-- 2) Le carnet-seed (rn=1) devient la description + une révision initiale.
, seeds AS (
  SELECT id, place_id, user_id, content, created_at FROM ranked WHERE rn = 1
    AND NULLIF(TRIM(content),'') IS NOT NULL
)
INSERT INTO place_description_revisions (place_id, content, edited_by, created_at)
SELECT place_id, content, user_id, created_at FROM seeds;

-- 3) Convertir les lignes seed en type 'description'
UPDATE place_contributions pc SET type = 'description', updated_at = now()
FROM (
  SELECT r.id FROM (
    SELECT pc.id, ROW_NUMBER() OVER (
      PARTITION BY pc.place_id
      ORDER BY (CASE WHEN a.author_id = pc.user_id THEN 0 ELSE 1 END), pc.votes_up DESC, pc.created_at ASC
    ) AS rn
    FROM place_contributions pc
    LEFT JOIN (SELECT place_id, user_id AS author_id FROM places_discovered WHERE method='author') a
      ON a.place_id = pc.place_id
    WHERE pc.type = 'carnet' AND NULLIF(TRIM(pc.content),'') IS NOT NULL
  ) r WHERE r.rn = 1
) s
WHERE pc.id = s.id;

-- 4) Tous les autres carnets restants deviennent des commentaires.
UPDATE place_contributions SET type = 'comment', updated_at = now()
WHERE type = 'carnet';

COMMIT;
```

- [ ] **Step 2 : Smoke-check**

```sql
-- plus aucun carnet
SELECT count(*) AS carnets FROM place_contributions WHERE type = 'carnet';     -- attendu 0
-- au plus une description par lieu
SELECT place_id, count(*) FROM place_contributions WHERE type='description'
  GROUP BY place_id HAVING count(*) > 1;                                       -- attendu 0 ligne
-- révisions seedées présentes
SELECT count(*) FROM place_description_revisions;                               -- attendu ≈ nb lieux décrits
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/197_carnet_collab_migrate_data.sql
git commit -m "feat(db): migration carnets -> description (seed) + commentaires"
```

---

## PHASE C — Front-end

### Task C1 : Types (`placeDetail.ts`)

**Files:**
- Modify: `apps/explore-web/src/types/placeDetail.ts`

- [ ] **Step 1 : Étendre les types**

Ajouter/modifier :

```ts
export type PlacePanelActiveTab = 'discussion' | 'galerie' | 'infos' | 'admin'

export interface V05Contribution {
  id: number
  userId: string
  factionId: string
  type: 'comment' | 'photo' | 'description' | 'accessibility' | 'season' | 'warning' | 'epoch'
  title: string | null
  content: string | null
  imageUrl: string | null
  images: string[]
  rating: number | null
  votesUp: number
  votesDown: number
  parentId: number | null
  likedByMe: boolean
  createdAt: string
  userName: string
  userAvatar: string | null
}

export interface V05Description {
  id: number
  content: string
  updatedAt: string
  editedBy: string
  editorName: string | null
  editorAvatar: string | null
  votesUp: number
  revisionCount: number
  likedByMe: boolean
}

// Dans V05Detail : ajouter
//   description: V05Description | null
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd "apps/explore-web" && pnpm build`
Expected: tsc échoue UNIQUEMENT sur les usages pas encore mis à jour (PlacePanel) — c'est attendu, corrigé en C7.

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/types/placeDetail.ts
git commit -m "feat(types): V05Description + parentId/likedByMe sur les contributions"
```

### Task C2 : `PhotoSlideshow` (bandeau sous le hero)

**Files:**
- Create: `apps/explore-web/src/components/places/views/PhotoSlideshow.tsx`
- Create: `apps/explore-web/src/components/places/views/PhotoSlideshow.css`

- [ ] **Step 1 : Composant**

```tsx
import './PhotoSlideshow.css'

interface PhotoSlideshowProps {
  photos: string[]
  onOpen: (photos: string[], index: number) => void
  onAddPhoto: () => void
}

export function PhotoSlideshow({ photos, onOpen, onAddPhoto }: PhotoSlideshowProps) {
  return (
    <div className="photo-slideshow">
      {photos.map((url, i) => (
        <button key={i} className="photo-slideshow-thumb" onClick={() => onOpen(photos, i)}>
          <img src={url} alt="" loading="lazy" />
        </button>
      ))}
      <button className="photo-slideshow-add" onClick={onAddPhoto}>
        <span>+</span>Photo
      </button>
    </div>
  )
}
```

- [ ] **Step 2 : CSS** (tokens existants — cf. maquette validée design-v3)

```css
.photo-slideshow{display:flex;gap:8px;padding:12px 16px 4px;overflow-x:auto;scrollbar-width:none}
.photo-slideshow::-webkit-scrollbar{display:none}
.photo-slideshow-thumb{flex:0 0 auto;width:74px;height:56px;border-radius:10px;overflow:hidden;
  border:1.5px solid rgba(255,255,255,.5);box-shadow:0 2px 6px rgba(74,55,40,.22);padding:0;cursor:pointer;background:none}
.photo-slideshow-thumb img{width:100%;height:100%;object-fit:cover}
.photo-slideshow-add{flex:0 0 auto;width:74px;height:56px;border-radius:10px;border:1.5px dashed var(--color-sepia-dark);
  color:var(--color-sepia-dark);display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-family:var(--font-accent);font-size:11px;gap:1px;cursor:pointer;background:rgba(255,255,255,.25)}
.photo-slideshow-add span{font-size:18px;line-height:1}
```

- [ ] **Step 3 : Build + commit**

Run: `cd "apps/explore-web" && pnpm build` → Expected: PASS (composant isolé).
```bash
git add apps/explore-web/src/components/places/views/PhotoSlideshow.*
git commit -m "feat(places): bandeau PhotoSlideshow sous le hero"
```

### Task C3 : `CourtFold` (Conquête repliée)

**Files:**
- Create: `apps/explore-web/src/components/places/details/CourtFold.tsx`
- Create: `apps/explore-web/src/components/places/details/CourtFold.css`

- [ ] **Step 1 : Composant** (replie `PlaceCourtView`, fermé par défaut)

```tsx
import { useState } from 'react'
import { PlaceCourtView } from './PlaceCourtView'
import './CourtFold.css'

interface CourtFoldProps {
  placeId: string
  placeTitle: string
  guardianName: string | null
}

export function CourtFold({ placeId, placeTitle, guardianName }: CourtFoldProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="court-fold-wrap">
      <button className="court-fold-bar" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="court-fold-crown">👑</span>
        <span className="court-fold-label">
          Conquête{guardianName ? <> — veillé par <b>{guardianName}</b></> : null}
        </span>
        <span className={`court-fold-chev${open ? ' open' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="court-fold-body">
          <PlaceCourtView placeId={placeId} placeTitle={placeTitle} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : CSS**

```css
.court-fold-wrap{margin-bottom:16px}
.court-fold-bar{width:100%;display:flex;align-items:center;gap:9px;background:rgba(74,55,40,.07);
  border:1px solid rgba(160,120,76,.22);border-radius:999px;padding:8px 14px;cursor:pointer;
  font-family:var(--font-accent);font-size:13px;color:var(--color-ink-light)}
.court-fold-crown{font-size:15px}
.court-fold-label b{color:var(--color-ink)}
.court-fold-chev{margin-left:auto;color:var(--color-sepia-dark);font-size:14px;transition:transform .2s}
.court-fold-chev.open{transform:rotate(180deg)}
.court-fold-body{margin-top:10px}
```

- [ ] **Step 3 : Build + commit**

Run: `cd "apps/explore-web" && pnpm build` → Expected: PASS.
```bash
git add apps/explore-web/src/components/places/details/CourtFold.*
git commit -m "feat(places): Conquête repliable (CourtFold) fermée par défaut"
```

### Task C4 : `CommentCard` + `DescriptionEditModal` + `DescriptionHistoryModal` + `AddPhotoModal`

**Files:**
- Create: `apps/explore-web/src/components/places/discussion/CommentCard.tsx` (+ `.css`)
- Create: `apps/explore-web/src/components/places/modals/DescriptionEditModal.tsx`
- Create: `apps/explore-web/src/components/places/modals/DescriptionHistoryModal.tsx`
- Create: `apps/explore-web/src/components/places/modals/AddPhotoModal.tsx`

- [ ] **Step 1 : `CommentCard.tsx`** — like via RPC existant `vote_contribution`/`unlike_contribution` (cf. ancien `CarnetCard`)

```tsx
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMapStore } from '../../../stores/mapStore'
import type { V05Contribution } from '../../../types/placeDetail'
import './CommentCard.css'

interface CommentCardProps {
  comment: V05Contribution
  replies: V05Contribution[]
  onPhotoOpen: (photos: string[], index: number) => void
  onReply: (parentId: number) => void
  onChanged: () => void
}

export function CommentCard({ comment, replies, onPhotoOpen, onReply, onChanged }: CommentCardProps) {
  const userId = usePlayerStore(s => s.userId)
  const [liked, setLiked] = useState(comment.likedByMe)
  const [count, setCount] = useState(comment.votesUp)
  const [busy, setBusy] = useState(false)

  async function toggleLike(id: number, isLiked: boolean) {
    if (!userId || busy) return
    setBusy(true)
    const rpc = isLiked ? 'unlike_contribution' : 'vote_contribution'
    const args = isLiked
      ? { p_user_id: userId, p_contribution_id: id }
      : { p_user_id: userId, p_contribution_id: id, p_vote: 1 }
    const { data, error } = await supabase.rpc(rpc, args)
    if (!error && (data as { success?: boolean } | null)?.success) {
      setLiked(!isLiked); setCount(c => isLiked ? Math.max(0, c - 1) : c + 1); onChanged()
    }
    setBusy(false)
  }

  return (
    <div className="cmt" id={`comment-${comment.id}`}>
      <div className="cmt-head">
        <button className="cmt-av-btn" onClick={() => useMapStore.getState().setSelectedPlayerId(comment.userId)}>
          {comment.userAvatar
            ? <img className="cmt-av" src={comment.userAvatar} alt="" />
            : <span className="cmt-av cmt-av-fallback">{comment.userName.charAt(0).toUpperCase()}</span>}
        </button>
        <span className="cmt-name">{comment.userName}</span>
        <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
      </div>
      {comment.images.length > 0 && (
        <div className="cmt-photos">
          {comment.images.map((u, i) => (
            <img key={i} src={u} alt="" loading="lazy" onClick={() => onPhotoOpen(comment.images, i)} />
          ))}
        </div>
      )}
      <p className="cmt-text">{comment.content}</p>
      <div className="cmt-foot">
        <button className={`cmt-mini${liked ? ' liked' : ''}`} onClick={() => toggleLike(comment.id, liked)} disabled={!userId || busy}>
          {liked ? '❤' : '🤍'} {count > 0 ? count : ''}
        </button>
        <button className="cmt-mini" onClick={() => onReply(comment.id)}>↩ Répondre</button>
      </div>
      {replies.length > 0 && (
        <div className="cmt-replies">
          {replies.map(r => (
            <CommentCard key={r.id} comment={r} replies={[]} onPhotoOpen={onPhotoOpen} onReply={() => onReply(comment.id)} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  )
}

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24); if (j < 7) return `il y a ${j} j`
  return `il y a ${Math.floor(j / 7)} sem.`
}
```

- [ ] **Step 2 : `CommentCard.css`** (entrées de journal — cf. design-v3)

```css
.cmt{padding:13px 0;border-top:1px solid rgba(160,120,76,.28)}
.cmt:first-of-type{border-top:none}
.cmt-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.cmt-av-btn{padding:0;border:none;background:none;cursor:pointer}
.cmt-av{width:30px;height:30px;border-radius:50%;object-fit:cover;display:flex;align-items:center;justify-content:center}
.cmt-av-fallback{background:var(--color-sepia);color:#fff;font-family:var(--font-accent);font-weight:700;font-size:12px}
.cmt-name{font-family:var(--font-accent);font-weight:700;font-size:13.5px;color:var(--color-ink)}
.cmt-time{font-family:var(--font-accent);font-size:11.5px;color:var(--color-sepia-dark);margin-left:auto;opacity:.8}
.cmt-photos{display:flex;gap:7px;margin:4px 0 7px;flex-wrap:wrap}
.cmt-photos img{width:84px;height:62px;border-radius:9px;object-fit:cover;border:1.5px solid rgba(255,255,255,.5);box-shadow:0 1px 5px rgba(74,55,40,.22);cursor:pointer}
.cmt-text{font-family:var(--font-body);font-size:14px;line-height:1.5;color:var(--color-ink)}
.cmt-foot{display:flex;align-items:center;gap:16px;margin-top:7px}
.cmt-mini{font-family:var(--font-accent);font-size:12.5px;color:var(--color-ink-light);cursor:pointer;background:none;border:none;display:flex;align-items:center;gap:4px}
.cmt-mini.liked{color:#9a3a28}
.cmt-replies{margin:10px 0 0 22px;padding-left:12px;border-left:2px solid rgba(160,120,76,.3)}
```

- [ ] **Step 3 : `DescriptionEditModal.tsx`** (réutilise le shell `AddCarnetModal.css` ou un style propre)

```tsx
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import '../modals/AddCarnetModal.css'

interface Props { placeId: string; initial: string; onClose: () => void; onSaved: () => void }

export function DescriptionEditModal({ placeId, initial, onClose, onSaved }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!userId || !text.trim() || saving) return
    setSaving(true); setError(null)
    const { data, error } = await supabase.rpc('edit_place_description', {
      p_user_id: userId, p_place_id: placeId, p_content: text.trim(),
    })
    const res = data as { success?: boolean; error?: string } | null
    if (error || res?.error) { setError(res?.error === 'not_discovered' ? "Découvrez ce lieu pour le décrire." : 'Erreur'); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div className="add-carnet-overlay">
      <div className="add-carnet-modal">
        <div className="add-carnet-header"><h3>Décrire ce lieu</h3><button className="add-carnet-close" onClick={onClose}>✕</button></div>
        <div className="add-carnet-body">
          <p style={{ fontSize: 13, color: 'var(--color-ink-light)', marginBottom: 8 }}>
            Tu enrichis la description commune. Chaque version est conservée dans l'historique.
          </p>
          <textarea className="add-carnet-textarea" value={text} onChange={e => setText(e.target.value)}
            placeholder="Décris ce lieu pour les autres aventuriers…" rows={8} />
          {error && <p className="add-carnet-error">{error}</p>}
        </div>
        <div className="add-carnet-footer">
          <button className="add-carnet-submit" onClick={save} disabled={saving || !text.trim()}>
            {saving ? 'Enregistrement…' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : `DescriptionHistoryModal.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import '../modals/AddCarnetModal.css'

interface Revision { id: number; content: string; createdAt: string; editorName: string | null }
interface Props { placeId: string; canRestore: boolean; onClose: () => void; onRestored: () => void }

export function DescriptionHistoryModal({ placeId, canRestore, onClose, onRestored }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [revs, setRevs] = useState<Revision[]>([])

  useEffect(() => {
    supabase.rpc('get_place_description_history', { p_place_id: placeId })
      .then(({ data }) => setRevs((data as Revision[]) ?? []))
  }, [placeId])

  async function restore(id: number) {
    if (!userId) return
    const { data } = await supabase.rpc('restore_place_description_revision', {
      p_user_id: userId, p_place_id: placeId, p_revision_id: id,
    })
    if ((data as { success?: boolean } | null)?.success) { onRestored(); onClose() }
  }

  return (
    <div className="add-carnet-overlay">
      <div className="add-carnet-modal">
        <div className="add-carnet-header"><h3>Historique du lieu</h3><button className="add-carnet-close" onClick={onClose}>✕</button></div>
        <div className="add-carnet-body">
          {revs.length === 0 && <p>Aucune révision.</p>}
          {revs.map((r, i) => (
            <div key={r.id} style={{ borderTop: i ? '1px solid var(--color-parchment-dark)' : 'none', padding: '10px 0' }}>
              <div style={{ fontFamily: 'var(--font-accent)', fontSize: 12, color: 'var(--color-ink-light)' }}>
                {r.editorName ?? '—'} · {new Date(r.createdAt).toLocaleString('fr-FR')}
              </div>
              <p style={{ fontSize: 14, margin: '4px 0' }}>{r.content}</p>
              {canRestore && i !== 0 && (
                <button className="add-carnet-submit" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => restore(r.id)}>
                  Restaurer cette version
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5 : `AddPhotoModal.tsx`** (upload sans texte → `add_place_photos`) — réutilise le pattern d'upload de l'ancien `AddCarnetModal` (bucket `place-images`, webp)

```tsx
import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import './AddCarnetModal.css'

interface Props { placeId: string; onClose: () => void; onSaved: () => void }

export function AddPhotoModal({ placeId, onClose, onSaved }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function add(fl: FileList | null) {
    if (!fl) return
    const next = Array.from(fl).slice(0, 5 - files.length)
    setFiles(p => [...p, ...next]); setPreviews(p => [...p, ...next.map(f => URL.createObjectURL(f))])
  }

  async function submit() {
    if (!userId || files.length === 0 || saving) return
    setSaving(true); setError(null)
    const urls: string[] = []
    for (const f of files) {
      const path = `places/${userId}/${crypto.randomUUID()}.webp`
      const { error: upErr } = await supabase.storage.from('place-images').upload(path, f, { contentType: 'image/webp', upsert: false })
      if (upErr) { setError('Erreur upload'); setSaving(false); return }
      urls.push(supabase.storage.from('place-images').getPublicUrl(path).data.publicUrl)
    }
    const { data, error } = await supabase.rpc('add_place_photos', { p_user_id: userId, p_place_id: placeId, p_images: urls })
    if (error || (data as { error?: string } | null)?.error) { setError('Erreur'); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div className="add-carnet-overlay">
      <div className="add-carnet-modal">
        <div className="add-carnet-header"><h3>Ajouter une photo</h3><button className="add-carnet-close" onClick={onClose}>✕</button></div>
        <div className="add-carnet-body">
          <div className="add-carnet-photos-grid">
            {previews.map((s, i) => (<div key={i} className="add-carnet-photo-thumb"><img src={s} alt="" /></div>))}
            {files.length < 5 && (<button className="add-carnet-photo-add" onClick={() => fileRef.current?.click()}>+</button>)}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => add(e.target.files)} />
          {error && <p className="add-carnet-error">{error}</p>}
        </div>
        <div className="add-carnet-footer">
          <button className="add-carnet-submit" onClick={submit} disabled={saving || files.length === 0}>
            {saving ? 'Envoi…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

> Note : les fichiers sont uploadés en `.webp` mais non recompressés ici (l'ancien modal ne le faisait pas non plus côté carnet). Conserver le même comportement.

- [ ] **Step 6 : Build + commit**

Run: `cd "apps/explore-web" && pnpm build` → Expected: PASS.
```bash
git add apps/explore-web/src/components/places/discussion/CommentCard.* \
        apps/explore-web/src/components/places/modals/DescriptionEditModal.tsx \
        apps/explore-web/src/components/places/modals/DescriptionHistoryModal.tsx \
        apps/explore-web/src/components/places/modals/AddPhotoModal.tsx
git commit -m "feat(places): CommentCard + modales description/historique/photo"
```

### Task C5 : `CommentComposer` + `DiscussionThread`

**Files:**
- Create: `apps/explore-web/src/components/places/discussion/CommentComposer.tsx`
- Create: `apps/explore-web/src/components/places/discussion/DiscussionThread.tsx`

- [ ] **Step 1 : `CommentComposer.tsx`** (texte et/ou photos → `add_place_comment` ; upload comme AddPhotoModal)

```tsx
import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'

interface Props { placeId: string; parentId?: number | null; onPosted: () => void }

export function CommentComposer({ placeId, parentId = null, onPosted }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function add(fl: FileList | null) {
    if (!fl) return
    const next = Array.from(fl).slice(0, 5 - files.length)
    setFiles(p => [...p, ...next]); setPreviews(p => [...p, ...next.map(f => URL.createObjectURL(f))])
  }

  async function post() {
    if (!userId || !text.trim() || busy) return
    setBusy(true)
    const urls: string[] = []
    for (const f of files) {
      const path = `places/${userId}/${crypto.randomUUID()}.webp`
      const { error } = await supabase.storage.from('place-images').upload(path, f, { contentType: 'image/webp', upsert: false })
      if (!error) urls.push(supabase.storage.from('place-images').getPublicUrl(path).data.publicUrl)
    }
    const { data, error } = await supabase.rpc('add_place_comment', {
      p_user_id: userId, p_place_id: placeId, p_content: text.trim(), p_images: urls, p_parent_id: parentId,
    })
    if (!error && (data as { success?: boolean } | null)?.success) {
      setText(''); setFiles([]); setPreviews([]); onPosted()
    }
    setBusy(false)
  }

  return (
    <div className="composer">
      <button className="composer-cam" onClick={() => fileRef.current?.click()} aria-label="Ajouter une photo">📷</button>
      <input className="composer-input" value={text} onChange={e => setText(e.target.value)}
        placeholder={parentId ? 'Votre réponse…' : 'Ajoute une photo, un conseil, une anecdote…'} />
      <button className="composer-send" onClick={post} disabled={busy || !text.trim()}>Publier</button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => add(e.target.files)} />
      {previews.length > 0 && (
        <div className="composer-previews">{previews.map((s, i) => <img key={i} src={s} alt="" />)}</div>
      )}
    </div>
  )
}
```

Styles `.composer*` à ajouter dans `PlacePanel.css` (Task C7) :

```css
.composer{display:flex;align-items:center;gap:9px;border:1px dashed var(--color-sepia-dark);border-radius:12px;padding:10px 12px;margin-bottom:14px;background:rgba(255,255,255,.3);flex-wrap:wrap}
.composer-cam{font-size:17px;background:none;border:none;cursor:pointer}
.composer-input{flex:1;border:none;background:none;font-family:var(--font-body);font-size:13.5px;color:var(--color-ink);outline:none;min-width:120px}
.composer-input::placeholder{font-style:italic;color:var(--color-ink-light)}
.composer-send{font-family:var(--font-accent);font-weight:700;font-size:12.5px;color:var(--color-sepia-dark);background:none;border:none;cursor:pointer}
.composer-previews{display:flex;gap:6px;width:100%}
.composer-previews img{width:54px;height:42px;border-radius:8px;object-fit:cover}
```

- [ ] **Step 2 : `DiscussionThread.tsx`** (compose le composer + l'arbre 1 niveau)

```tsx
import { useMemo, useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { CommentCard } from './CommentCard'
import { CommentComposer } from './CommentComposer'
import type { V05Contribution } from '../../../types/placeDetail'

interface Props {
  placeId: string
  comments: V05Contribution[]   // type === 'comment'
  onPhotoOpen: (photos: string[], index: number) => void
  onChanged: () => void
}

export function DiscussionThread({ placeId, comments, onPhotoOpen, onChanged }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [replyTo, setReplyTo] = useState<number | null>(null)

  const roots = useMemo(() => comments.filter(c => c.parentId === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [comments])
  const repliesByParent = useMemo(() => {
    const m = new Map<number, V05Contribution[]>()
    comments.filter(c => c.parentId !== null).forEach(c => {
      const arr = m.get(c.parentId!) ?? []; arr.push(c); m.set(c.parentId!, arr)
    })
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return m
  }, [comments])

  return (
    <div className="discussion-thread">
      {userId && replyTo === null && (
        <CommentComposer placeId={placeId} onPosted={onChanged} />
      )}
      {roots.length === 0 && <p className="place-tab-empty">Personne n'a encore écrit ici. Lance la discussion !</p>}
      {roots.map(c => (
        <div key={c.id}>
          <CommentCard
            comment={c}
            replies={repliesByParent.get(c.id) ?? []}
            onPhotoOpen={onPhotoOpen}
            onReply={(pid) => setReplyTo(prev => prev === pid ? null : pid)}
            onChanged={onChanged}
          />
          {userId && replyTo === c.id && (
            <div style={{ marginLeft: 22 }}>
              <CommentComposer placeId={placeId} parentId={c.id} onPosted={() => { setReplyTo(null); onChanged() }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3 : Build + commit**

Run: `cd "apps/explore-web" && pnpm build` → Expected: PASS.
```bash
git add apps/explore-web/src/components/places/discussion/CommentComposer.tsx \
        apps/explore-web/src/components/places/discussion/DiscussionThread.tsx
git commit -m "feat(places): composer unifié + fil de discussion (réponses 1 niveau)"
```

### Task C6 : `PlaceDescription` (encart manuscrit)

**Files:**
- Create: `apps/explore-web/src/components/places/details/PlaceDescription.tsx`
- Create: `apps/explore-web/src/components/places/details/PlaceDescription.css`

- [ ] **Step 1 : Composant** (like sur la description = même RPC que les commentaires)

```tsx
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import type { V05Description } from '../../../types/placeDetail'
import './PlaceDescription.css'

interface Props {
  description: V05Description | null
  canEdit: boolean              // a découvert le lieu
  onEdit: () => void
  onOpenHistory: () => void
  onChanged: () => void
}

export function PlaceDescription({ description, canEdit, onEdit, onOpenHistory, onChanged }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [liked, setLiked] = useState(description?.likedByMe ?? false)
  const [count, setCount] = useState(description?.votesUp ?? 0)
  const [busy, setBusy] = useState(false)

  async function toggleLike() {
    if (!userId || !description || busy) return
    setBusy(true)
    const rpc = liked ? 'unlike_contribution' : 'vote_contribution'
    const args = liked ? { p_user_id: userId, p_contribution_id: description.id }
      : { p_user_id: userId, p_contribution_id: description.id, p_vote: 1 }
    const { data, error } = await supabase.rpc(rpc, args)
    if (!error && (data as { success?: boolean } | null)?.success) {
      setLiked(!liked); setCount(c => liked ? Math.max(0, c - 1) : c + 1); onChanged()
    }
    setBusy(false)
  }

  if (!description) {
    return (
      <div className="place-descr place-descr-empty">
        <div className="place-descr-rule"><span>LE LIEU</span></div>
        <p className="place-descr-invite">Aucune description pour l'instant.{canEdit ? ' Sois le premier à décrire ce lieu.' : ''}</p>
        {canEdit && <button className="place-descr-contribute" onClick={onEdit}>✎ Décrire ce lieu</button>}
      </div>
    )
  }

  return (
    <div className="place-descr">
      <div className="place-descr-rule"><span>LE LIEU</span></div>
      <p className="place-descr-text">{description.content}</p>
      <div className="place-descr-foot">
        <span className="place-descr-credit">
          {description.revisionCount > 1 ? `Enrichi par plusieurs aventuriers · ` : ''}
          <button className="place-descr-history" onClick={onOpenHistory}>voir l'historique</button>
        </span>
        <div className="place-descr-actions">
          <button className={`place-descr-seal${liked ? ' liked' : ''}`} onClick={toggleLike} disabled={!userId || busy}>
            {liked ? '❤' : '🤍'} {count > 0 ? count : ''}
          </button>
          {canEdit && <button className="place-descr-contribute" onClick={onEdit}>✎ Contribuer</button>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : CSS** (page de manuscrit — Alegreya + lettrine + filet, cf. design-v3)

```css
.place-descr{position:relative;margin:4px 0 18px;padding:16px 16px 13px;background:rgba(255,251,244,.82);
  border:1px solid rgba(160,120,76,.45);border-radius:14px;box-shadow:0 1px 0 rgba(255,255,255,.6) inset,0 8px 22px rgba(74,55,40,.14)}
.place-descr-rule{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.place-descr-rule:before,.place-descr-rule:after{content:"";height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--color-sepia),transparent)}
.place-descr-rule span{font-family:var(--font-title);letter-spacing:.14em;font-size:15px;color:var(--color-sepia-dark)}
.place-descr-text{font-family:var(--font-signature);font-size:16px;line-height:1.62;color:#3f2f22;text-align:justify}
.place-descr-text::first-letter{font-family:var(--font-title);font-size:46px;float:left;line-height:.78;padding:6px 9px 0 0;color:var(--color-sepia-dark)}
.place-descr-invite{font-family:var(--font-signature);font-style:italic;color:var(--color-ink-light);margin:6px 0 10px}
.place-descr-foot{display:flex;align-items:center;justify-content:space-between;margin-top:11px;padding-top:9px;border-top:1px dashed #e0cdae;gap:8px;flex-wrap:wrap}
.place-descr-credit{font-family:var(--font-accent);font-size:12px;color:var(--color-ink-light)}
.place-descr-history{background:none;border:none;color:var(--color-sepia-dark);text-decoration:underline;cursor:pointer;font:inherit}
.place-descr-actions{display:flex;gap:8px}
.place-descr-seal{display:flex;align-items:center;gap:5px;font-family:var(--font-accent);font-size:12.5px;font-weight:600;background:#fff;border:1px solid #e6d3b8;border-radius:999px;padding:4px 11px;color:var(--color-ink);cursor:pointer}
.place-descr-seal.liked{background:#f3d9d0;border-color:#e0b3a4;color:#9a3a28}
.place-descr-contribute{display:flex;align-items:center;gap:5px;font-family:var(--font-accent);font-size:12.5px;font-weight:600;background:var(--color-ink);color:var(--color-parchment);border-radius:999px;padding:5px 13px;cursor:pointer;border:none}
```

- [ ] **Step 3 : Build + commit**

Run: `cd "apps/explore-web" && pnpm build` → Expected: PASS.
```bash
git add apps/explore-web/src/components/places/details/PlaceDescription.*
git commit -m "feat(places): PlaceDescription — encart manuscrit collaboratif"
```

### Task C7 : Recâbler `PlacePanel.tsx` + `PlacePanel.css` + `PlaceGallery`

**Files:**
- Modify: `apps/explore-web/src/components/places/views/PlacePanel.tsx`
- Modify: `apps/explore-web/src/components/places/views/PlacePanel.css`
- Modify: `apps/explore-web/src/components/places/views/PlaceGallery.tsx`

- [ ] **Step 1 : Fond parchemin** — dans `PlacePanel.css`, sur `.place-panel`, ajouter le fond texturé :

```css
/* import en tête du fichier si besoin via le composant ; ici on cible la classe */
.place-panel{
  background-color: var(--color-parchment);
  background-image: url('../../../assets/parchemin.png');
  background-size: cover;
  background-position: center top;
}
```

- [ ] **Step 2 : Remplacer les Carnets par Discussion dans `PlacePanel.tsx`**

Modifications précises :
1. **Imports** : retirer `CarnetCard`/`AddCarnetModal`/`PlaceGallery`(reste) ; ajouter
   `PlaceDescription`, `DiscussionThread`, `PhotoSlideshow`, `CourtFold`, `DescriptionEditModal`,
   `DescriptionHistoryModal`, `AddPhotoModal`.
2. **Onglet par défaut** : `useState<PlacePanelActiveTab>(() => useMapStore.getState().selectedPlaceTab ?? 'discussion')`.
3. **Dérivations** (remplacer le bloc `carnets` par) :

```tsx
const comments = useMemo<V05Contribution[]>(
  () => (v05?.contributions ?? []).filter(c => c.type === 'comment'),
  [v05?.contributions],
)
const galleryPhotos = useMemo(() => {
  const fromContrib = (v05?.contributions ?? [])
    .filter(c => c.type === 'comment' || c.type === 'photo' || c.type === 'description')
    .flatMap(c => c.images.map(url => ({ url, carnetId: c.id })))
  const fromPlace = (place.images ?? []).map(img => ({ url: img.url, carnetId: -1 }))
  const seen = new Set<string>()
  return [...fromContrib, ...fromPlace].filter(p => (seen.has(p.url) ? false : (seen.add(p.url), true)))
}, [v05?.contributions, place.images])
const heroPhotos = useMemo(() => galleryPhotos.map(p => p.url), [galleryPhotos])
const canEditDescription = v05?.isExplorer === true || isAuthor
  || usePlayerStore.getState().discoveredIds.has(place.id)
```

4. **État local** : remplacer `showAddCarnet/editingCarnet/...` par
   `const [showEditDescr, setShowEditDescr] = useState(false)`,
   `const [showHistory, setShowHistory] = useState(false)`,
   `const [showAddPhoto, setShowAddPhoto] = useState(false)`.
5. **Modales plein panneau** : remplacer le bloc `if (showAddCarnet || editingCarnet)` par des rendus
   conditionnels de `DescriptionEditModal` / `DescriptionHistoryModal` / `AddPhotoModal`.
6. **Sous le hero** : insérer `<PhotoSlideshow photos={heroPhotos} onOpen={(p,i)=>setLightbox({photos:p,index:i})} onAddPhoto={()=>setShowAddPhoto(true)} />`.
7. **Description** : juste avant les onglets, remplacer l'ancien bloc par
   `<PlaceDescription description={v05?.description ?? null} canEdit={canEditDescription} onEdit={()=>setShowEditDescr(true)} onOpenHistory={()=>setShowHistory(true)} onChanged={refreshV05} />`.
8. **La Cour** : remplacer `<PlaceCourtView .../>` par
   `<CourtFold placeId={place.id} placeTitle={place.title} guardianName={v05?.guardian?.name ?? null} />`.
9. **Onglets** : ordre `Discussion · Galerie · Infos (· Admin)`. Onglet `discussion` :

```tsx
{activeTab === 'discussion' && (
  <div className="place-tab-content">
    <DiscussionThread placeId={place.id} comments={comments}
      onPhotoOpen={(p,i)=>setLightbox({photos:p,index:i})} onChanged={refreshV05} />
  </div>
)}
```

10. Supprimer toute référence à `userHasCarnet`, `onWriteCarnet`, `handleDeleteCarnet`,
    `deleteConfirmPlaceId` liés au carnet, et le CTA « Ajouter mon propre récit ».
    (Conserver la logique titre/rename, explorers, rating prompt, suppression de lieu admin.)

> Pour le détail des fragments existants à retirer, voir `PlacePanel.tsx:433-479` (dérivations carnets),
> `:565-580` (modal carnet), `:920-950` (onglet carnets), `:1003-1019` (confirm delete carnet).

- [ ] **Step 3 : `PlaceGallery.tsx`** — vérifier qu'il accepte toujours `photos: {url, carnetId}[]`. Le `onPhotoClick(carnetId)` n'a plus de cible « carnet » : le rebrancher pour ouvrir le lightbox via `onPhotoOpen` uniquement (supprimer `onPhotoClick`/scroll-to-carnet). Adapter la signature si nécessaire et son appel dans PlacePanel.

- [ ] **Step 4 : Build (doit passer entièrement maintenant)**

Run: `cd "apps/explore-web" && pnpm build`
Expected: PASS (0 erreur TS). Corriger les imports/types orphelins jusqu'au vert.

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/places/views/PlacePanel.tsx \
        apps/explore-web/src/components/places/views/PlacePanel.css \
        apps/explore-web/src/components/places/views/PlaceGallery.tsx
git commit -m "feat(places): PlacePanel recâblé — description + discussion + slideshow + Cour repliée"
```

### Task C8 : Suppression du code mort + vérif finale

**Files:**
- Delete: `apps/explore-web/src/components/places/cards/CarnetCard.tsx` (+ `.css`)
- Delete: `apps/explore-web/src/components/places/modals/AddCarnetModal.tsx`
  (⚠️ garder `AddCarnetModal.css` tant que les nouvelles modales la réutilisent — ou copier les classes nécessaires dans un `modal-shell.css` puis supprimer)

- [ ] **Step 1 : Vérifier qu'aucun import ne référence `CarnetCard`/`AddCarnetModal`**

Run (Grep): rechercher `CarnetCard` et `AddCarnetModal` dans `src/` — attendu : seulement les imports CSS conservés.

- [ ] **Step 2 : Supprimer les fichiers morts**, puis build.

Run: `cd "apps/explore-web" && pnpm build` → Expected: PASS.

- [ ] **Step 3 : Vérif visuelle manuelle** (`pnpm dev`, port 3000) — checklist :
  - Hero + slideshow ; « + Photo » ouvre `AddPhotoModal` et la photo apparaît en galerie.
  - Conquête repliée par défaut, se déplie sur tap.
  - Discussion = onglet ouvert par défaut, premier.
  - Description : édition réservée aux découvreurs (sinon pas de bouton Contribuer) ; ❤ fonctionne ; historique liste + restaure.
  - Commentaire texte+photo, ❤, réponse 1 niveau.

- [ ] **Step 4 : Commit**

```bash
git add -A apps/explore-web/src/components/places/
git commit -m "chore(places): suppression carnets V0.5 (code mort)"
```

---

## PHASE D — Mémoire / Citadelle (spec §11)

### Task D1 : Mettre à jour la Bible Game Design

**Files (vault Obsidian) :**
- `📱 L'application (La Carte)/🎮 Bible Game Design.md` (section « Les Récits »)
- `📱 L'application (La Carte)/Décisions Game Design 2026.md`

- [ ] **Step 1** : Remplacer la section « Les Récits » par la description du carnet collaboratif (wiki + discussion), acter la fin des carnets individuels, et **corriger** « Gloire = Exploration + Érudition » → noter la décision Uriel (2026-06-02) : *la Gloire n'est pas de l'érudition ; contribuer à un lieu est un geste gratuit*.
- [ ] **Step 2** : Ajouter une entrée dans `Décisions Game Design 2026.md` (date, décision, conséquences).
- [ ] **Step 3** : Appender au `log.md` de la Citadelle : `## [DATE] refonte fiches lieu — carnet collaboratif`.

---

## Self-Review (à la fin)

- **Couverture spec** : §2 anatomie → C7 ; §3 description wiki+historique → A1/A2/C6 ; §4 discussion → C5/C4 ;
  §5 likes → réutilise `vote_contribution` (C4/C6) ; §6 galerie découplée → C7 ; §7 migration → B1 ;
  §7bis visuel → C2/C3/C6/C7 (parchemin, manuscrit, Cour repliée, Discussion défaut) ; §8 modèle → A1/A2 ;
  §11 mémoire → D1. ✅
- **Pas de récompense** : aucune RPC nouvelle n'appelle `contribute_to_place` ni n'ajoute de points (geste gratuit). ✅ (drop volontaire du +5 exploration de l'ancien `type='photo'`.)
- **Cohérence des noms** : RPCs `edit_place_description` / `restore_place_description_revision` /
  `get_place_description_history` / `add_place_comment` / `add_place_photos` ; champ JSON `description`,
  `parentId`, `likedByMe` utilisés identiquement RPC↔types↔composants.
