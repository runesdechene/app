# Page de modération des lieux (Hub) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter le Hub d'une page où des modérateurs corrigent les tags des lieux, éditent/masquent les lieux hors-sujet, et suivent lesquels ils ont vérifiés — avec un accès restreint à cette page + la page Tags.

**Architecture :** Un canal SQL privilégié (RPCs `mod_*` gated par rôle `admin|moderator`, `SECURITY DEFINER`) qui n'écrit jamais dans le fil de jeu (contributions/activity/notifs), plus deux colonnes `verified_at/verified_by` sur `places` et une table d'audit `place_moderation_log`. Côté Hub React : un gate de rôle (un modérateur pur ne voit que Modération + Tags) et une page liste-paginée-serveur avec panneau d'édition.

**Tech Stack :** Supabase Postgres (migrations SQL, `npx supabase db push --linked`) · React 18 + Vite 5 + TypeScript strict · React Router · CSS global (thème parchemin).

## Global Constraints

- **pnpm uniquement** ; `npx` seulement pour `supabase`. Build : `pnpm --filter hub build`.
- **TypeScript strict — aucun `any`, aucun `@ts-ignore`, aucun `as unknown as X`.**
- **Migrations SQL numérotées**, canal unique `npx supabase db push --linked`. **Jamais** `apply_migration` MCP ni dashboard SQL (orphelins timestamp). Prochaine migration = **329**.
- Tout `CREATE OR REPLACE` se base sur la def **LIVE** — ici on part de la baseline mig 238 pour `set_place_tags`, copiée-collée puis adaptée.
- **Pas de harnais de tests front dans le Hub.** Cycle de vérif = `pnpm --filter hub build` (tsc strict) + smoke tests SQL (`mcp__plugin_supabase_supabase__execute_sql`, project_id `ukpapqssgsxirsgmcvof`) + vérif runtime prod. Les « tests » ci-dessous sont ces smoke checks — pas de Jest/Vitest.
- **Conventions Hub** : pattern `SaveBar` (pas d'auto-save), `try/finally` autour des fetch, deep copy (`JSON.parse(JSON.stringify())`) pour comparaison, refetch serveur après chaque save, préfixe CSS `pub-*` interdit sur les pubs (sans objet ici).
- **Rôle via JWT** : `session.user.app_metadata.user_role` (synchrone, aucune requête). Un `moderator` porte `user_role='moderator'` (trigger mig 179).
- **Déploiement Netlify manuel** : `cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build`.

---

## File Structure

- **Create** `supabase/migrations/329_hub_place_moderation.sql` — colonnes verified, table audit, `_is_staff`, 6 RPCs `mod_*`.
- **Create** `apps/hub/src/components/moderation/PlacesModeration.tsx` — page conteneur (liste, filtres, pagination, état).
- **Create** `apps/hub/src/components/moderation/PlaceRow.tsx` — une ligne de liste (infos + signaux).
- **Create** `apps/hub/src/components/moderation/PlaceEditPanel.tsx` — panneau d'édition déplié (tags, champs, contexte, actions).
- **Create** `apps/hub/src/components/moderation/TagPicker.tsx` — sélecteur de tags (max 3, 1er = primary).
- **Create** `apps/hub/src/components/moderation/types.ts` — types partagés du module.
- **Create** `apps/hub/src/lib/relativeTime.ts` — helper « il y a X » (standalone).
- **Modify** `apps/hub/src/hooks/useAuth.ts` — exposer `isStaff`, `isModerator`.
- **Modify** `apps/hub/src/App.tsx` — gate staff + routes restreintes modérateur + route `/moderation`.
- **Modify** `apps/hub/src/components/Sidebar.tsx` — menu restreint pour modérateur pur ; lien Modération.
- **Modify** `apps/hub/src/App.css` — classes `.mod-*` (thème parchemin).
- **Modify** `apps/hub/CLAUDE.md` — documenter le module modération (règle E3).

---

## Task 1 : Migration SQL — backend modération complet

**Files:**
- Create: `supabase/migrations/329_hub_place_moderation.sql`

**Interfaces:**
- Produces (consommées par le front) :
  - `mod_list_places(p_search text, p_filter text, p_tag_id text, p_limit int, p_offset int) → json` : `{ total:int, rows:[{ id, title, address, latitude, longitude, masked, sensible, created_at, verified_at, author_id, author_name, verified_by_name, photo_count, visit_count, tags:[{id,title,color,background,is_primary}] }] }`. `p_filter ∈ {'unverified','verified','all'}`.
  - `mod_get_place(p_place_id text) → json` : `{ id, title, text, address, latitude, longitude, masked, sensible, created_at, updated_at, verified_at, verified_by_name, author_id, author_name, author_contributions, author_places_count, visit_count, discovered_count, rating_avg, rating_count, photo_count }`.
  - `mod_set_place_tags(p_place_id text, p_tag_ids text[]) → json` : `{success:true, tagIds}` ou `{error}`.
  - `mod_update_place(p_place_id text, p_title text, p_text text, p_sensible boolean) → json` : `{success:true}` ou `{error}`.
  - `mod_set_masked(p_place_id text, p_masked boolean) → json` : `{success:true, masked}` ou `{error}`.
  - `mod_set_verified(p_place_id text, p_verified boolean) → json` : `{success:true, verified}` ou `{error}`.

- [ ] **Step 1 : Écrire la migration**

Create `supabase/migrations/329_hub_place_moderation.sql` :

```sql
-- 329_hub_place_moderation.sql
-- WHY : page de modération Hub. Des modérateurs (role='moderator') corrigent les
-- tags des lieux, masquent les hors-sujet, et marquent « vérifié » ce qu'ils ont
-- passé en revue. Canal privilégié dédié : gate par rôle (_is_staff), JAMAIS la
-- garde présence _can_edit_place_meta (pensée joueur), et AUCUNE écriture dans le
-- fil de jeu (place_contributions / activity_log / notifications) — une action de
-- modération n'est pas une contribution. Audit dans place_moderation_log ; les
-- changements de tags restent aussi tracés dans place_tags_revisions.
--
-- Réversible : DROP des 6 fonctions mod_* + _is_staff ; DROP TABLE
-- place_moderation_log ; ALTER TABLE places DROP COLUMN verified_at, verified_by.

BEGIN;

-- 1) État « vérifié » global du lieu -----------------------------------------
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verified_by text NULL
    REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.places.verified_at IS
  'Non NULL = lieu passé en revue par un modérateur (page Hub Modération).';

-- 2) Journal d'audit des actions de modération -------------------------------
CREATE TABLE IF NOT EXISTS public.place_moderation_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id     varchar(255) NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  moderator_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  action       text NOT NULL,   -- set_tags | update | mask | unmask | verify | unverify
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_place_moderation_log_place
  ON public.place_moderation_log (place_id, created_at DESC);
GRANT SELECT ON public.place_moderation_log TO authenticated, service_role;

-- 3) Gate staff --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_staff(p_caller text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $staff$
  SELECT p_caller IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_caller AND role IN ('admin','moderator')
  );
$staff$;
ALTER FUNCTION public._is_staff(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._is_staff(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_staff(text) TO authenticated, service_role;

-- 4) mod_list_places : liste paginée serveur + total ------------------------
CREATE OR REPLACE FUNCTION public.mod_list_places(
  p_search text DEFAULT NULL,
  p_filter text DEFAULT 'unverified',
  p_tag_id text DEFAULT NULL,
  p_limit  int  DEFAULT 50,
  p_offset int  DEFAULT 0
) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $list$
DECLARE
  v_caller text := public._caller_user_id();
  v_total  int;
  v_rows   json;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;

  SELECT count(*) INTO v_total
    FROM public.places p
   WHERE (p_search IS NULL OR p.title ILIKE '%'||p_search||'%')
     AND (p_filter <> 'unverified' OR p.verified_at IS NULL)
     AND (p_filter <> 'verified'   OR p.verified_at IS NOT NULL)
     AND (p_tag_id IS NULL OR EXISTS (
           SELECT 1 FROM public.place_tags pt
            WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id));

  SELECT json_agg(row_to_json(r)) INTO v_rows FROM (
    SELECT
      p.id, p.title, p.address, p.latitude, p.longitude,
      p.masked, p.sensible, p.created_at, p.verified_at, p.author_id,
      COALESCE(au.display_name, au.first_name) AS author_name,
      vu.display_name AS verified_by_name,
      CASE WHEN jsonb_typeof(p.images) = 'array'
           THEN jsonb_array_length(p.images) ELSE 0 END AS photo_count,
      (SELECT count(*) FROM public.place_explorers pe WHERE pe.place_id = p.id) AS visit_count,
      COALESCE((
        SELECT json_agg(json_build_object(
                 'id', t.id, 'title', t.title, 'color', t.color,
                 'background', t.background, 'is_primary', pt.is_primary)
                 ORDER BY pt.is_primary DESC)
          FROM public.place_tags pt JOIN public.tags t ON t.id = pt.tag_id
         WHERE pt.place_id = p.id), '[]'::json) AS tags
    FROM public.places p
    LEFT JOIN public.users au ON au.id = p.author_id
    LEFT JOIN public.users vu ON vu.id = p.verified_by
    WHERE (p_search IS NULL OR p.title ILIKE '%'||p_search||'%')
      AND (p_filter <> 'unverified' OR p.verified_at IS NULL)
      AND (p_filter <> 'verified'   OR p.verified_at IS NOT NULL)
      AND (p_tag_id IS NULL OR EXISTS (
            SELECT 1 FROM public.place_tags pt
             WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id))
    ORDER BY (p.verified_at IS NOT NULL), p.created_at DESC
    LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  ) r;

  RETURN json_build_object('total', v_total, 'rows', COALESCE(v_rows, '[]'::json));
END; $list$;
ALTER FUNCTION public.mod_list_places(text,text,text,int,int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_list_places(text,text,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_list_places(text,text,text,int,int) TO authenticated, service_role;

-- 5) mod_get_place : détail complet (panneau d'édition) ---------------------
CREATE OR REPLACE FUNCTION public.mod_get_place(p_place_id text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $get$
DECLARE
  v_caller text := public._caller_user_id();
  v_json   json;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;

  SELECT json_build_object(
    'id', p.id, 'title', p.title, 'text', p.text, 'address', p.address,
    'latitude', p.latitude, 'longitude', p.longitude,
    'masked', p.masked, 'sensible', p.sensible,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'verified_at', p.verified_at,
    'verified_by_name', vu.display_name,
    'author_id', p.author_id,
    'author_name', COALESCE(au.display_name, au.first_name),
    'author_contributions', au.contributions_count,
    'author_places_count', (SELECT count(*) FROM public.places pa WHERE pa.author_id = p.author_id),
    'visit_count', (SELECT count(*) FROM public.place_explorers pe WHERE pe.place_id = p.id),
    'discovered_count', (SELECT count(*) FROM public.places_discovered pd WHERE pd.place_id = p.id),
    'rating_avg', (SELECT round(avg(rating)::numeric, 1) FROM public.place_ratings pr WHERE pr.place_id = p.id),
    'rating_count', (SELECT count(*) FROM public.place_ratings pr WHERE pr.place_id = p.id),
    'photo_count', CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END
  ) INTO v_json
  FROM public.places p
  LEFT JOIN public.users au ON au.id = p.author_id
  LEFT JOIN public.users vu ON vu.id = p.verified_by
  WHERE p.id = p_place_id;

  IF v_json IS NULL THEN
    RETURN json_build_object('error','place_not_found');
  END IF;
  RETURN v_json;
END; $get$;
ALTER FUNCTION public.mod_get_place(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_get_place(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_get_place(text) TO authenticated, service_role;

-- 6) mod_set_place_tags : baseline mig 238 SAUF gate = _is_staff -------------
-- (copie-colle de set_place_tags mig 238 ; seule différence : le gate présence
--  _can_edit_place_meta est remplacé par _is_staff, + ligne place_moderation_log.)
CREATE OR REPLACE FUNCTION public.mod_set_place_tags(p_place_id text, p_tag_ids text[])
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $tags$
DECLARE
  v_caller  text := public._caller_user_id();
  v_n       int  := COALESCE(array_length(p_tag_ids, 1), 0);
  v_old_pat jsonb;
  v_old_ids text[];
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;
  IF v_n < 1 THEN RETURN json_build_object('error','no_tags'); END IF;
  IF v_n > 3 THEN RETURN json_build_object('error','too_many_tags'); END IF;
  IF (SELECT count(DISTINCT tid) FROM unnest(p_tag_ids) tid) <> v_n THEN
    RETURN json_build_object('error','duplicate_tag');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_tag_ids) tid
     WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE id = tid)
  ) THEN
    RETURN json_build_object('error','invalid_tag');
  END IF;

  SELECT jsonb_object_agg(tag_id, to_jsonb(created_by)),
         array_agg(tag_id ORDER BY is_primary DESC)
    INTO v_old_pat, v_old_ids
    FROM public.place_tags WHERE place_id = p_place_id;

  DELETE FROM public.place_tags WHERE place_id = p_place_id;

  INSERT INTO public.place_tags (place_id, tag_id, is_primary, created_at, created_by)
  SELECT p_place_id, t.tag_id, (t.ord = 1), NOW(),
         CASE WHEN v_old_pat ? t.tag_id
              THEN NULLIF(v_old_pat->>t.tag_id, '')
              ELSE v_caller END
  FROM unnest(p_tag_ids) WITH ORDINALITY AS t(tag_id, ord);

  INSERT INTO public.place_tags_revisions (place_id, changed_by, old_tag_ids, new_tag_ids)
  VALUES (p_place_id, v_caller, COALESCE(v_old_ids, '{}'), p_tag_ids);

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, 'set_tags',
          jsonb_build_object('old', COALESCE(v_old_ids,'{}'), 'new', p_tag_ids));

  UPDATE public.places SET updated_at = NOW() WHERE id = p_place_id;
  RETURN json_build_object('success', true, 'tagIds', p_tag_ids);
END; $tags$;
ALTER FUNCTION public.mod_set_place_tags(text, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_set_place_tags(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_set_place_tags(text, text[]) TO authenticated, service_role;

-- 7) mod_update_place : title / text / sensible -----------------------------
CREATE OR REPLACE FUNCTION public.mod_update_place(
  p_place_id text, p_title text, p_text text, p_sensible boolean
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $upd$
DECLARE v_caller text := public._caller_user_id();
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;

  UPDATE public.places SET
    title    = COALESCE(NULLIF(TRIM(p_title), ''), title),
    text     = COALESCE(p_text, text),
    sensible = COALESCE(p_sensible, sensible),
    updated_at = NOW()
  WHERE id = p_place_id;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, 'update',
          jsonb_build_object('title', p_title, 'sensible', p_sensible));

  RETURN json_build_object('success', true);
END; $upd$;
ALTER FUNCTION public.mod_update_place(text,text,text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_update_place(text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_update_place(text,text,text,boolean) TO authenticated, service_role;

-- 8) mod_set_masked : retrait réversible de l'app ---------------------------
CREATE OR REPLACE FUNCTION public.mod_set_masked(p_place_id text, p_masked boolean)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $mask$
DECLARE v_caller text := public._caller_user_id();
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;

  UPDATE public.places SET masked = p_masked, updated_at = NOW() WHERE id = p_place_id;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, CASE WHEN p_masked THEN 'mask' ELSE 'unmask' END, '{}'::jsonb);

  RETURN json_build_object('success', true, 'masked', p_masked);
END; $mask$;
ALTER FUNCTION public.mod_set_masked(text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_set_masked(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_set_masked(text,boolean) TO authenticated, service_role;

-- 9) mod_set_verified : bascule vérifié -------------------------------------
CREATE OR REPLACE FUNCTION public.mod_set_verified(p_place_id text, p_verified boolean)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $ver$
DECLARE v_caller text := public._caller_user_id();
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;

  IF p_verified THEN
    UPDATE public.places SET verified_at = NOW(), verified_by = v_caller WHERE id = p_place_id;
  ELSE
    UPDATE public.places SET verified_at = NULL, verified_by = NULL WHERE id = p_place_id;
  END IF;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, CASE WHEN p_verified THEN 'verify' ELSE 'unverify' END, '{}'::jsonb);

  RETURN json_build_object('success', true, 'verified', p_verified);
END; $ver$;
ALTER FUNCTION public.mod_set_verified(text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_set_verified(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_set_verified(text,boolean) TO authenticated, service_role;

COMMIT;
```

- [ ] **Step 2 : Appliquer la migration**

Run: `npx supabase db push --linked`
Expected: la migration `329_hub_place_moderation.sql` s'applique sans erreur (`Applying migration 329...` / `Finished supabase db push`).

- [ ] **Step 3 : Smoke test — colonnes + gate + liste**

Via `mcp__plugin_supabase_supabase__execute_sql` (project_id `ukpapqssgsxirsgmcvof`) :

```sql
-- a) colonnes créées
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='places' AND column_name IN ('verified_at','verified_by');
-- b) gate : un non-staff échoue (simulé en appelant _is_staff avec un id user lambda)
SELECT public._is_staff('__inexistant__') AS should_be_false;
-- c) liste renvoie bien {total, rows} (SECURITY DEFINER : _caller_user_id() sera NULL hors JWT
--    => on teste juste que la fonction existe et renvoie l'erreur de gate attendue)
SELECT public.mod_list_places(NULL, 'unverified', NULL, 5, 0) AS r;
```
Expected: (a) 2 lignes ; (b) `false` ; (c) `{"error":"not_staff"}` (car appel sans JWT staff — comportement correct du gate).

- [ ] **Step 4 : Smoke test — écritures (avec un vrai staff)**

Prérequis : récupérer un `id` de lieu de test et vérifier que l'appelant SQL est admin. Comme `execute_sql` n'a pas de JWT utilisateur, tester les écritures **depuis le Hub en prod après Task 5** (un admin est staff). Ici, vérifier seulement que les fonctions existent :

```sql
SELECT proname FROM pg_proc WHERE proname IN
 ('mod_list_places','mod_get_place','mod_set_place_tags','mod_update_place','mod_set_masked','mod_set_verified','_is_staff')
 ORDER BY proname;
```
Expected: 7 lignes.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/329_hub_place_moderation.sql
git commit -m "feat(db): backend modération lieux — verified + audit + RPCs mod_* (mig 329)"
```
Le hook post-commit relance `graphify-sql.py` (touche `supabase/migrations/`).

---

## Task 2 : Gate de rôle Hub (auth + routes + sidebar)

**Files:**
- Modify: `apps/hub/src/hooks/useAuth.ts`
- Modify: `apps/hub/src/App.tsx`
- Modify: `apps/hub/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: rien (JWT déjà lu par `useAuth`).
- Produces: `useAuth()` renvoie en plus `isStaff: boolean`, `isModerator: boolean`. `<Sidebar user role isAdmin />`. Route `/moderation`.

- [ ] **Step 1 : `useAuth` — exposer isStaff/isModerator**

Modify `apps/hub/src/hooks/useAuth.ts`, bloc de retour (remplacer l'objet retourné) :

```ts
  return {
    ...state,
    signOut,
    isAuthenticated: !!state.user,
    isAdmin: state.role === 'admin',
    isModerator: state.role === 'moderator',
    isStaff: state.role === 'admin' || state.role === 'moderator',
  }
```

- [ ] **Step 2 : `App.tsx` — gate staff + routes restreintes + route /moderation**

Modify `apps/hub/src/App.tsx` :

Ajouter l'import :
```ts
import { PlacesModeration } from './components/moderation/PlacesModeration'
```

Remplacer la déstructuration `useAuth()` :
```ts
  const { user, role, loading, isAuthenticated, isAdmin, isModerator, isStaff, signOut } = useAuth()
```

Remplacer le bloc `if (!isAdmin) { return <AccessDenied ... /> }` par :
```ts
  if (!isStaff) {
    return <AccessDenied onSignOut={signOut} email={user?.email} role={role} />
  }

  // Modérateur pur : accès limité à Modération + Tags.
  if (isModerator && !isAdmin) {
    return (
      <div className="app">
        <Sidebar user={user} role={role} isAdmin={isAdmin} />
        <main className="main-content">
          <Routes>
            <Route path="/moderation" element={<PlacesModeration />} />
            <Route path="/carte/tags" element={<TagsManager />} />
            <Route path="*" element={<PlacesModeration />} />
          </Routes>
        </main>
      </div>
    )
  }
```

Dans le bloc admin (`return (<div className="app">…`), passer les props à la sidebar et ajouter la route :
```tsx
        <Sidebar user={user} role={role} isAdmin={isAdmin} />
```
et dans `<Routes>` admin, ajouter (après la route `/photos`) :
```tsx
          <Route path="/moderation" element={<PlacesModeration />} />
```

- [ ] **Step 3 : `Sidebar.tsx` — props + menu restreint**

Modify `apps/hub/src/components/Sidebar.tsx`. Remplacer l'interface et la signature :

```tsx
interface SidebarProps {
  user: User | null
  role: string | null
  isAdmin: boolean
}

export function Sidebar({ user, role: _role, isAdmin }: SidebarProps) {
```

Juste après `<nav className="sidebar-nav">`, insérer le lien Modération (visible pour tous les staff), puis rendre le reste conditionnel à l'admin. Concrètement, ajouter en premier lien :

```tsx
        <NavLink to="/moderation" className={({ isActive }) => isActive ? 'active' : ''}>
          Modération
        </NavLink>
```

Et envelopper tout le bloc existant (Dashboard, Utilisateurs, Contenu, section « La Carte » complète, Communication, Shopify) dans `{isAdmin && ( … )}`, SAUF le lien Tags qui doit rester accessible au modérateur. Pour rester simple et DRY, structurer ainsi :

```tsx
      <nav className="sidebar-nav">
        <NavLink to="/moderation" className={({ isActive }) => isActive ? 'active' : ''}>
          Modération
        </NavLink>
        <div className="sidebar-section-label">La Carte</div>
        <NavLink to="/carte/tags" className={({ isActive }) => isActive ? 'active' : ''}>
          Tags
        </NavLink>

        {isAdmin && (
          <>
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>Dashboard</NavLink>
            <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>Utilisateurs</NavLink>
            <NavLink to="/photos" className={({ isActive }) => isActive ? 'active' : ''}>
              Contenu communautaire
              {pending > 0 && (
                <span style={{ marginLeft: 8, background: '#e0a73d', color: '#2b2b2b', fontSize: 11, fontWeight: 700, minWidth: 18, display: 'inline-block', textAlign: 'center', padding: '1px 7px', borderRadius: 999, verticalAlign: 'middle' }}>
                  {pending}
                </span>
              )}
            </NavLink>
            <NavLink to="/carte/factions" className={({ isActive }) => isActive ? 'active' : ''}>Factions</NavLink>
            <NavLink to="/carte/titres" className={({ isActive }) => isActive ? 'active' : ''}>Titres</NavLink>
            <NavLink to="/carte/fragments" className={({ isActive }) => isActive ? 'active' : ''}>Fragments</NavLink>
            <NavLink to="/carte/associer" className={({ isActive }) => isActive ? 'active' : ''}>Associer Fragments</NavLink>
            <NavLink to="/carte/shopify" className={({ isActive }) => isActive ? 'active' : ''}>Shopify Unlocks</NavLink>
            <NavLink to="/carte/publicites" className={({ isActive }) => isActive ? 'active' : ''}>Publicites</NavLink>
            <NavLink to="/carte/bannieres" className={({ isActive }) => isActive ? 'active' : ''}>Bannières</NavLink>
            <NavLink to="/carte/enigmes" className={({ isActive }) => isActive ? 'active' : ''}>Enigmes</NavLink>
            <NavLink to="/carte/missions" className={({ isActive }) => isActive ? 'active' : ''}>Missions</NavLink>
            <NavLink to="/carte/reglages" className={({ isActive }) => isActive ? 'active' : ''}>Reglages</NavLink>
            <NavLink to="/carte/divers" className={({ isActive }) => isActive ? 'active' : ''}>Divers</NavLink>
            <NavLink to="/carte/landing" className={({ isActive }) => isActive ? 'active' : ''}>Page d'accueil</NavLink>
            <NavLink to="/carte/regles" className={({ isActive }) => isActive ? 'active' : ''}>Règles</NavLink>
            <NavLink to="/carte/tutoriel" className={({ isActive }) => isActive ? 'active' : ''}>Tutoriel</NavLink>
            <div className="sidebar-section-label">Communication</div>
            <NavLink to="/annonces" className={({ isActive }) => isActive ? 'active' : ''}>Annonces</NavLink>
            <div className="sidebar-section-label">Shopify</div>
            <NavLink to="/shopify/sync" className={({ isActive }) => isActive ? 'active' : ''}>Synchro Emails</NavLink>
          </>
        )}
      </nav>
```

(Le `pending`/`get_photo_submissions` reste tel quel ; il n'est utilisé que dans le bloc admin — c'est acceptable, un modérateur ne le lit pas.)

- [ ] **Step 4 : Build (avec un stub temporaire de PlacesModeration)**

`PlacesModeration` n'existe pas encore (Task 3). Pour que ce commit compile isolément, créer un stub minimal :

Create `apps/hub/src/components/moderation/PlacesModeration.tsx` :
```tsx
export function PlacesModeration() {
  return <div className="page-header"><h1>Modération</h1></div>
}
```

Run: `pnpm --filter hub build`
Expected: `tsc` OK, `vite build` produit `dist/` sans erreur.

- [ ] **Step 5 : Commit**

```bash
git add apps/hub/src/hooks/useAuth.ts apps/hub/src/App.tsx apps/hub/src/components/Sidebar.tsx apps/hub/src/components/moderation/PlacesModeration.tsx
git commit -m "feat(hub): gate de rôle modérateur (accès Modération + Tags) + route /moderation"
```

---

## Task 3 : Page liste — PlacesModeration (fetch, filtres, recherche, pagination)

**Files:**
- Create: `apps/hub/src/components/moderation/types.ts`
- Create: `apps/hub/src/lib/relativeTime.ts`
- Create: `apps/hub/src/components/moderation/PlaceRow.tsx`
- Modify: `apps/hub/src/components/moderation/PlacesModeration.tsx` (remplace le stub)
- Modify: `apps/hub/src/App.css`

**Interfaces:**
- Consumes: `mod_list_places` (Task 1).
- Produces: `ModListRow`, `ModTag` (types.ts) ; `relativeTime(iso: string): string` ; `<PlaceRow row open onToggle />`.

- [ ] **Step 1 : Types partagés**

Create `apps/hub/src/components/moderation/types.ts` :
```ts
export interface ModTag {
  id: string
  title: string
  color: string
  background: string
  is_primary: boolean
}

export interface ModListRow {
  id: string
  title: string
  address: string
  latitude: number
  longitude: number
  masked: boolean
  sensible: boolean
  created_at: string
  verified_at: string | null
  author_id: string
  author_name: string | null
  verified_by_name: string | null
  photo_count: number
  visit_count: number
  tags: ModTag[]
}

export type ModFilter = 'unverified' | 'verified' | 'all'

export interface ModListResult {
  total: number
  rows: ModListRow[]
}

export interface ModPlaceDetail {
  id: string
  title: string
  text: string
  address: string
  latitude: number
  longitude: number
  masked: boolean
  sensible: boolean
  created_at: string
  updated_at: string
  verified_at: string | null
  verified_by_name: string | null
  author_id: string
  author_name: string | null
  author_contributions: number | null
  author_places_count: number
  visit_count: number
  discovered_count: number
  rating_avg: number | null
  rating_count: number
  photo_count: number
}
```

- [ ] **Step 2 : Helper temps relatif**

Create `apps/hub/src/lib/relativeTime.ts` :
```ts
// Formatte une date ISO en « il y a X » (fr). Standalone, pas React-aware.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const day = 86_400_000
  const days = Math.floor(diff / day)
  if (days < 1) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days} j`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months} mois`
  const years = Math.floor(days / 365)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}
```

- [ ] **Step 3 : Composant PlaceRow (ligne fermée)**

Create `apps/hub/src/components/moderation/PlaceRow.tsx` :
```tsx
import type { ModListRow } from './types'
import { relativeTime } from '../../lib/relativeTime'

interface Props {
  row: ModListRow
  open: boolean
  onToggle: () => void
}

export function PlaceRow({ row, open, onToggle }: Props) {
  const suspicious = row.tags.length === 0 || (row.visit_count === 0 && row.photo_count === 0)
  return (
    <div className={`mod-row-main${open ? ' open' : ''}`} onClick={onToggle}>
      <div className="mod-thumb">🗺️</div>
      <div className="mod-row-body">
        <h4>{row.title || <em>(sans titre)</em>}</h4>
        <div className="mod-badges">
          {row.tags.length === 0 && <span className="mod-flag warn">aucun tag</span>}
          {row.tags.map(t => (
            <span key={t.id} className={`mod-badge${t.is_primary ? ' primary' : ''}`}
                  style={{ background: t.background, color: t.color }}>
              {t.title}{t.is_primary ? ' ★' : ''}
            </span>
          ))}
        </div>
        <div className="mod-meta">
          <span>👤 <b>{row.author_name ?? '?'}</b></span>
          <span>🕒 <b>{relativeTime(row.created_at)}</b></span>
          {row.address && <span>📍 {row.address}</span>}
          <span>👁️ <b>{row.visit_count}</b></span>
          <span>📷 <b>{row.photo_count}</b></span>
          {row.masked && <span className="mod-flag">masqué</span>}
          {suspicious && row.tags.length > 0 && <span className="mod-flag warn">peu d'activité</span>}
        </div>
      </div>
      <div className="mod-row-state">
        {row.verified_at
          ? <><div className="mod-vstate ok">✓ Vérifié</div>
              <div className="mod-vsub">{row.verified_by_name ?? ''}</div></>
          : <><div className="mod-vstate no">● À traiter</div></>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : PlacesModeration — conteneur (remplace le stub)**

Replace `apps/hub/src/components/moderation/PlacesModeration.tsx` :
```tsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { ModFilter, ModListResult, ModListRow } from './types'
import { PlaceRow } from './PlaceRow'

const PAGE = 50

export function PlacesModeration() {
  const [filter, setFilter] = useState<ModFilter>('unverified')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<ModListRow[]>([])
  const [total, setTotal] = useState(0)
  const [verifiedTotal, setVerifiedTotal] = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  // Debounce recherche
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('mod_list_places', {
        p_search: debounced || null,
        p_filter: filter,
        p_tag_id: null,
        p_limit: PAGE,
        p_offset: page * PAGE,
      })
      if (!error && data && !(data as { error?: string }).error) {
        const res = data as ModListResult
        setRows(res.rows)
        setTotal(res.total)
      }
    } finally {
      setLoading(false)
    }
  }, [debounced, filter, page])

  // Compteurs de progression (vérifiés / total) — indépendants du filtre courant.
  const fetchCounters = useCallback(async () => {
    const [{ data: all }, { data: ver }] = await Promise.all([
      supabase.rpc('mod_list_places', { p_search: null, p_filter: 'all', p_tag_id: null, p_limit: 1, p_offset: 0 }),
      supabase.rpc('mod_list_places', { p_search: null, p_filter: 'verified', p_tag_id: null, p_limit: 1, p_offset: 0 }),
    ])
    if (all && !(all as { error?: string }).error) setGrandTotal((all as ModListResult).total)
    if (ver && !(ver as { error?: string }).error) setVerifiedTotal((ver as ModListResult).total)
  }, [])

  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { fetchCounters() }, [fetchCounters])

  function refreshAll() { fetchList(); fetchCounters() }

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const pct = grandTotal > 0 ? Math.round((verifiedTotal / grandTotal) * 100) : 0

  return (
    <div className="mod-wrap">
      <div className="mod-head">
        <h1 className="mod-title">Modération des lieux</h1>
        <div className="mod-progress">
          <div className="mod-progress-bar"><div className="mod-progress-fill" style={{ width: `${pct}%` }} /></div>
          <div className="mod-progress-label">{verifiedTotal} / {grandTotal} vérifiés</div>
        </div>
      </div>

      <div className="mod-toolbar">
        {(['unverified', 'verified', 'all'] as ModFilter[]).map(f => (
          <button key={f} className={`mod-pill${filter === f ? ' active' : ''}`}
                  onClick={() => { setFilter(f); setPage(0) }}>
            {f === 'unverified' ? 'À traiter' : f === 'verified' ? 'Vérifiés' : 'Tous'}
          </button>
        ))}
        <input className="mod-search" placeholder="🔍 Rechercher par titre…"
               value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {rows.length === 0 && <p className="mod-empty">Aucun lieu.</p>}
          {rows.map(row => (
            <div key={row.id} className={`mod-row${openId === row.id ? ' open' : ''}`}>
              <PlaceRow row={row} open={openId === row.id}
                        onToggle={() => setOpenId(openId === row.id ? null : row.id)} />
              {/* Panneau d'édition ajouté en Task 4 */}
            </div>
          ))}

          <div className="mod-pager">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Précédent</button>
            <span>page {page + 1} / {pages}</span>
            <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Suivant ›</button>
          </div>
        </>
      )}
    </div>
  )
}
```

(`refreshAll` est branché sur les actions en Task 4 ; on l'expose déjà pour éviter un second refactor.)

- [ ] **Step 5 : CSS liste**

Append to `apps/hub/src/App.css` :
```css
/* ── Modération des lieux ─────────────────────────────── */
.mod-wrap { max-width: 1000px; }
.mod-head { display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
.mod-title { font-size:22px; font-weight:700; margin:0; }
.mod-progress { flex:1; min-width:220px; }
.mod-progress-bar { height:8px; background:#e7d9c4; border-radius:6px; overflow:hidden; }
.mod-progress-fill { height:100%; background:linear-gradient(90deg,#8a6d3b,#c19a6b); transition:width .3s; }
.mod-progress-label { font-size:12px; color:#7a6a55; margin-top:4px; }
.mod-toolbar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:16px; }
.mod-pill { padding:6px 12px; border-radius:20px; border:1px solid #d8c6a8; background:#f5ecdd; font-size:13px; cursor:pointer; }
.mod-pill.active { background:#3a2f25; color:#f5ecdd; border-color:#3a2f25; }
.mod-search { flex:1; min-width:160px; padding:7px 12px; border-radius:8px; border:1px solid #d8c6a8; background:#fffaf0; font-size:13px; }
.mod-row { background:#fffaf0; border:1px solid #e7d9c4; border-radius:10px; margin-bottom:8px; overflow:hidden; }
.mod-row.open { border-color:#c19a6b; box-shadow:0 2px 10px rgba(138,109,59,.12); }
.mod-row-main { display:grid; grid-template-columns:56px 1fr auto; gap:12px; padding:12px; align-items:center; cursor:pointer; }
.mod-thumb { width:56px; height:56px; border-radius:8px; background:#e7d9c4; display:flex; align-items:center; justify-content:center; font-size:20px; }
.mod-row-body h4 { margin:0 0 4px; font-size:15px; }
.mod-badges { display:flex; gap:5px; flex-wrap:wrap; margin:4px 0; }
.mod-badge { font-size:11px; padding:2px 9px; border-radius:12px; font-weight:600; }
.mod-badge.primary { outline:2px solid rgba(0,0,0,.15); outline-offset:1px; }
.mod-meta { font-size:12px; color:#7a6a55; display:flex; gap:12px; flex-wrap:wrap; margin-top:4px; }
.mod-meta b { color:#5a4a38; font-weight:600; }
.mod-flag { font-size:10px; padding:2px 7px; border-radius:5px; background:#f0e2cc; color:#8a6d3b; }
.mod-flag.warn { background:#f6dede; color:#a23; }
.mod-row-state { text-align:right; }
.mod-vstate { font-size:12px; font-weight:600; }
.mod-vstate.no { color:#b8860b; }
.mod-vstate.ok { color:#3d8b3d; }
.mod-vsub { font-size:11px; color:#9a8a75; }
.mod-pager { display:flex; gap:12px; align-items:center; justify-content:center; margin-top:14px; font-size:13px; color:#7a6a55; }
.mod-pager button { padding:6px 12px; border-radius:8px; border:1px solid #d8c6a8; background:#f5ecdd; cursor:pointer; }
.mod-pager button:disabled { opacity:.4; cursor:default; }
.mod-empty { color:#7a6a55; font-size:14px; }
```

- [ ] **Step 6 : Build**

Run: `pnpm --filter hub build`
Expected: OK, aucune erreur tsc.

- [ ] **Step 7 : Commit**

```bash
git add apps/hub/src/components/moderation/ apps/hub/src/lib/relativeTime.ts apps/hub/src/App.css
git commit -m "feat(hub): page modération — liste paginée, filtres, recherche, signaux"
```

---

## Task 4 : Panneau d'édition — TagPicker + PlaceEditPanel + actions

**Files:**
- Create: `apps/hub/src/components/moderation/TagPicker.tsx`
- Create: `apps/hub/src/components/moderation/PlaceEditPanel.tsx`
- Modify: `apps/hub/src/components/moderation/PlacesModeration.tsx` (brancher le panneau + refresh)
- Modify: `apps/hub/src/App.css` (styles panneau)

**Interfaces:**
- Consumes: `mod_get_place`, `mod_set_place_tags`, `mod_update_place`, `mod_set_masked`, `mod_set_verified` (Task 1) ; `ModTag`, `ModPlaceDetail` (Task 3).
- Produces: `<TagPicker allTags selected onChange />` ; `<PlaceEditPanel placeId onChanged />`.

- [ ] **Step 1 : TagPicker**

Create `apps/hub/src/components/moderation/TagPicker.tsx` :
```tsx
import type { ModTag } from './types'

interface Props {
  allTags: ModTag[]
  selected: string[]           // ordre significatif : selected[0] = primary
  onChange: (ids: string[]) => void
}

// Max 3 tags. Clic ajoute (si <3) ou retire. Le 1er de la liste = principal.
export function TagPicker({ allTags, selected, onChange }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else if (selected.length < 3) {
      onChange([...selected, id])
    }
  }
  function makePrimary(id: string) {
    onChange([id, ...selected.filter(x => x !== id)])
  }
  return (
    <div className="mod-tagpick">
      {allTags.map(t => {
        const sel = selected.includes(t.id)
        const primary = selected[0] === t.id
        return (
          <span key={t.id}
                className={`mod-tagchip${sel ? ' sel' : ''}`}
                style={sel ? { background: t.background, color: t.color, borderColor: t.color } : undefined}
                onClick={() => toggle(t.id)}
                onDoubleClick={() => sel && makePrimary(t.id)}
                title={sel ? 'Double-clic = définir comme principal' : ''}>
            {t.title}{primary ? ' ★' : ''}
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 : PlaceEditPanel**

Create `apps/hub/src/components/moderation/PlaceEditPanel.tsx` :
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ModTag, ModPlaceDetail } from './types'
import { TagPicker } from './TagPicker'

interface Props {
  placeId: string
  currentTags: ModTag[]        // tags de la ligne (ordre primary-first)
  allTags: ModTag[]
  onChanged: () => void        // refresh liste + compteurs après action
}

export function PlaceEditPanel({ placeId, currentTags, allTags, onChanged }: Props) {
  const [detail, setDetail] = useState<ModPlaceDetail | null>(null)
  const [tagIds, setTagIds] = useState<string[]>(currentTags.map(t => t.id))
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [sensible, setSensible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setDetail(null)
    supabase.rpc('mod_get_place', { p_place_id: placeId }).then(({ data }) => {
      if (!active || !data || (data as { error?: string }).error) return
      const d = data as ModPlaceDetail
      setDetail(d)
      setTitle(d.title ?? '')
      setText(d.text ?? '')
      setSensible(d.sensible)
    })
    return () => { active = false }
  }, [placeId])

  async function call(fn: string, params: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null)
    try {
      const { data, error } = await supabase.rpc(fn, params)
      const err = error?.message ?? (data as { error?: string })?.error
      setMsg(err ? `Erreur : ${err}` : ok)
      if (!err) onChanged()
    } finally {
      setBusy(false)
    }
  }

  const saveTags = () => {
    if (tagIds.length < 1) { setMsg('Au moins 1 tag'); return }
    call('mod_set_place_tags', { p_place_id: placeId, p_tag_ids: tagIds }, 'Tags enregistrés')
  }
  const saveFields = () =>
    call('mod_update_place', { p_place_id: placeId, p_title: title, p_text: text, p_sensible: sensible }, 'Lieu mis à jour')
  const toggleVerified = () =>
    call('mod_set_verified', { p_place_id: placeId, p_verified: !detail?.verified_at }, 'Statut vérifié mis à jour')
  const toggleMasked = () =>
    call('mod_set_masked', { p_place_id: placeId, p_masked: !detail?.masked }, 'Visibilité mise à jour')

  if (!detail) return <div className="mod-panel"><span className="loading">Chargement…</span></div>

  const mapsUrl = `https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`

  return (
    <div className="mod-panel">
      <div>
        <h5>Tags (max 3 · 1er = principal, double-clic)</h5>
        <TagPicker allTags={allTags} selected={tagIds} onChange={setTagIds} />
        <button className="mod-btn" style={{ marginTop: 10 }} onClick={saveTags} disabled={busy}>
          Enregistrer les tags
        </button>

        <div className="mod-field" style={{ marginTop: 14 }}>
          <label>Titre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="mod-field">
          <label>Description</label>
          <textarea rows={3} value={text} onChange={e => setText(e.target.value)} />
        </div>
        <label className="mod-toggle">
          <input type="checkbox" checked={sensible} onChange={e => setSensible(e.target.checked)} />
          Marquer « sensible »
        </label>
        <button className="mod-btn" style={{ marginTop: 8 }} onClick={saveFields} disabled={busy}>
          Enregistrer titre / description
        </button>
      </div>

      <div>
        <h5>Contexte</h5>
        <div className="mod-infolist">
          <div><b>ID :</b> {detail.id}</div>
          <div><b>Auteur :</b> {detail.author_name ?? '?'} · {detail.author_places_count} lieux · {detail.author_contributions ?? 0} contrib.</div>
          <div><b>Créé :</b> {new Date(detail.created_at).toLocaleDateString('fr-FR')}</div>
          <div><b>Modifié :</b> {new Date(detail.updated_at).toLocaleDateString('fr-FR')}</div>
          <div><b>Adresse :</b> {detail.address || '—'}</div>
          <div><b>Coords :</b> {detail.latitude.toFixed(4)}, {detail.longitude.toFixed(4)} · <a href={mapsUrl} target="_blank" rel="noreferrer">Maps ↗</a></div>
          <div><b>Visites :</b> {detail.visit_count} · <b>Découvertes :</b> {detail.discovered_count}</div>
          <div><b>Photos :</b> {detail.photo_count} · <b>Note :</b> {detail.rating_avg ?? '—'} ({detail.rating_count})</div>
          <div><b>État :</b> {detail.masked ? 'masqué' : 'visible'}{detail.sensible ? ' · sensible' : ''}</div>
          <div><b>Vérif. :</b> {detail.verified_at ? `${detail.verified_by_name ?? ''} · ${new Date(detail.verified_at).toLocaleDateString('fr-FR')}` : 'jamais'}</div>
        </div>
      </div>

      <div className="mod-actions">
        <button className="mod-btn verify" onClick={toggleVerified} disabled={busy}>
          {detail.verified_at ? 'Retirer la vérification' : '✓ Marquer comme vérifié'}
        </button>
        <button className="mod-btn mask" onClick={toggleMasked} disabled={busy}>
          {detail.masked ? 'Démasquer' : 'Masquer de l\'app'}
        </button>
        {msg && <span className="mod-msg">{msg}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Brancher le panneau + charger les tags dans PlacesModeration**

Modify `apps/hub/src/components/moderation/PlacesModeration.tsx` :

Ajouter les imports :
```tsx
import { PlaceEditPanel } from './PlaceEditPanel'
import type { ModTag } from './types'
```

Ajouter un state pour tous les tags + le fetch (après les autres `useState`) :
```tsx
  const [allTags, setAllTags] = useState<ModTag[]>([])
```
et un `useEffect` de chargement :
```tsx
  useEffect(() => {
    supabase.from('tags').select('id, title, color, background').order('order')
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setAllTags(data.map(t => ({ ...t, is_primary: false } as ModTag)))
        }
      })
  }, [])
```

Remplacer le commentaire `{/* Panneau d'édition ajouté en Task 4 */}` par :
```tsx
              {openId === row.id && (
                <PlaceEditPanel
                  placeId={row.id}
                  currentTags={row.tags}
                  allTags={allTags}
                  onChanged={refreshAll}
                />
              )}
```

- [ ] **Step 4 : CSS panneau**

Append to `apps/hub/src/App.css` :
```css
.mod-panel { border-top:1px dashed #d8c6a8; padding:16px; background:#fdf6e8; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.mod-panel h5 { margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:.5px; color:#8a6d3b; }
.mod-field { margin-bottom:10px; }
.mod-field label { display:block; font-size:11px; color:#7a6a55; margin-bottom:3px; }
.mod-field input, .mod-field textarea { width:100%; padding:7px 9px; border-radius:7px; border:1px solid #d8c6a8; background:#fffaf0; font-size:13px; box-sizing:border-box; }
.mod-tagpick { display:flex; gap:6px; flex-wrap:wrap; }
.mod-tagchip { font-size:12px; padding:4px 11px; border-radius:14px; border:1px solid #d8c6a8; background:#fff; cursor:pointer; opacity:.5; user-select:none; }
.mod-tagchip.sel { opacity:1; }
.mod-toggle { display:flex; align-items:center; gap:8px; font-size:13px; color:#5a4a38; }
.mod-infolist { font-size:12px; color:#5a4a38; line-height:1.9; }
.mod-infolist b { color:#7a6a55; font-weight:600; }
.mod-actions { grid-column:1/-1; display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding-top:8px; border-top:1px solid #eaddc6; }
.mod-btn { padding:8px 14px; border-radius:8px; border:1px solid #d8c6a8; background:#f5ecdd; font-size:13px; cursor:pointer; font-weight:600; }
.mod-btn:disabled { opacity:.5; cursor:default; }
.mod-btn.verify { background:#3d8b3d; color:#fff; border-color:#3d8b3d; }
.mod-btn.mask { background:#b8860b; color:#fff; border-color:#b8860b; }
.mod-msg { font-size:12px; color:#5a4a38; }
```

- [ ] **Step 5 : Build**

Run: `pnpm --filter hub build`
Expected: OK, aucune erreur tsc.

- [ ] **Step 6 : Vérif runtime (dev)**

Run: `pnpm --filter hub dev` (port 3001), se connecter en **admin** (staff), aller sur `/moderation`.
Vérifier : la liste charge (filtre « À traiter » ~3083), la recherche filtre, la pagination marche, ouvrir une ligne charge le contexte, changer un tag + « Enregistrer les tags » → la ligne se met à jour, « Marquer comme vérifié » → la ligne sort de « À traiter » et la barre de progression avance.

- [ ] **Step 7 : Commit**

```bash
git add apps/hub/src/components/moderation/ apps/hub/src/App.css
git commit -m "feat(hub): panneau d'édition modération — tags, champs, contexte, actions"
```

---

## Task 5 : Doc + déploiement + activation d'un modérateur

**Files:**
- Modify: `apps/hub/CLAUDE.md`

- [ ] **Step 1 : Documenter le module (règle E3)**

Append to `apps/hub/CLAUDE.md`, nouvelle section :
```markdown
## Modération des lieux (2026-07-07)

> Spec : `docs/superpowers/specs/2026-07-07-moderation-lieux-hub-design.md`
> Plan : `docs/superpowers/plans/2026-07-07-moderation-lieux-hub.md` (mig 329)

Page `/moderation` (`components/moderation/`) pour le rôle **`moderator`** (et admin).
Un modérateur pur n'accède qu'à **Modération** + **Tags** (gate dans `App.tsx` +
`Sidebar` conditionnée à `isAdmin`). Édition via RPCs privilégiées `mod_*`
(gate `_is_staff`, jamais la garde présence joueur, aucune écriture jeu) :
`mod_list_places` / `mod_get_place` / `mod_set_place_tags` / `mod_update_place` /
`mod_set_masked` / `mod_set_verified`. Audit : `place_moderation_log` +
`place_tags_revisions`. « Vérifié » = `places.verified_at/verified_by` (action
explicite, découplée de l'édition). Retrait = **masquage réversible seul**, pas
de suppression dure côté mod.
```

- [ ] **Step 2 : Commit doc**

```bash
git add apps/hub/CLAUDE.md
git commit -m "docs(hub): documente le module modération des lieux"
```

- [ ] **Step 3 : Déployer le Hub**

Run:
```bash
cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build
```
Expected: déploiement prod OK, URL `hub.runesdechene.com`.

- [ ] **Step 4 : Activer un compte modérateur de test (validation du gate)**

Via `execute_sql` (choisir un email de test réel) :
```sql
UPDATE public.users SET role = 'moderator' WHERE email = '<email_test>';
```
Le trigger mig 179 propage `user_role='moderator'` dans le JWT au prochain login.
Se connecter avec ce compte sur `hub.runesdechene.com` : vérifier qu'il ne voit
que **Modération** + **Tags**, qu'il peut corriger un tag et marquer vérifié, et
qu'une URL comme `/users` retombe sur la page Modération (pas d'accès admin).

- [ ] **Step 5 : Push final**

```bash
git push
```

---

## Self-Review (couverture spec)

| Exigence spec | Task |
|---|---|
| `verified_at`/`verified_by` sur `places` | 1 (step 1) |
| `place_moderation_log` | 1 |
| `_is_staff` + 6 RPCs `mod_*` sans pollution jeu | 1 |
| `mod_set_place_tags` = baseline 238 + gate staff + audit | 1 (step 1, §6) |
| Masquage réversible, pas de delete dur | 1 (`mod_set_masked` seul ; aucun `mod_delete`) |
| Vérifié = action explicite découplée | 4 (`toggleVerified` séparé des saves) |
| `isStaff`/`isModerator` | 2 (step 1) |
| Modérateur pur → Modération + Tags seulement | 2 (steps 2-3) |
| Route `/moderation` | 2 |
| Liste paginée serveur (3083, 50/page) | 3 |
| Filtres À traiter/Vérifiés/Tous + recherche titre | 3 |
| Signaux d'alerte (aucun tag, peu d'activité) | 3 (`PlaceRow`) |
| Barre progression X/3083 | 3 |
| Bloc contexte max d'infos (auteur, ancienneté, visites, photos, note…) | 4 (`mod_get_place` + panneau) |
| Sélecteur tags max 3, 1er = primary | 4 (`TagPicker`) |
| Refetch après save (règle Hub) | 4 (`onChanged`→`refreshAll`) |
| Doc sous-app (règle E3) | 5 |

**Note de décision (assumée)** : la maquette montrait « niveau auteur » et « influence » ; ces valeurs **n'ont pas de source canonique simple** (`users` sans colonne niveau ; pas de table `place_influence` directe). Elles sont **retirées** du panneau au profit de `author_places_count` + `contributions_count` (existants) et des compteurs visites/découvertes/note. Signalé pour transparence.
