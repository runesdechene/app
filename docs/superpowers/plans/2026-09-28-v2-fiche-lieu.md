# Explore — la fiche d'un lieu et le geste de visite : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** toucher un lieu ouvre sa fiche telle que maquettée ; on peut en avoir envie, la
partager, la retrouver sur la carte, la visiter en GPS (à 200 m, le serveur juge) puis la
revendiquer, seul ou avec les Explorateurs présents autour.

**Architecture :** deux migrations de fonctions V2 (`auth.uid()`, jamais de `p_user_id`) : la
lecture (`fiche_lieu`, `explorateurs_du_lieu`, `basculer_envie`, `mes_noms_d_expedition`), puis
le geste (`presences`, `signaler_presence`, `visiter_lieu`, `compagnons_possibles`,
`revendiquer_lieu`). Côté V2, une zone neuve `features/lieu` (api → lib → hooks → composants),
branchée par `app/routes/lieu.tsx`. Les règles d'affichage (état du bouton, distance, ligne de
faits) sont des fonctions pures testées seules.

**Tech Stack :** PostgreSQL + PostGIS (Supabase), React 19, React Router 8, TanStack Query 5,
supabase-js 2, Vitest.

**Spec :** `docs/superpowers/specs/2026-09-28-v2-fiche-lieu-design.md` (révise la spec Carte §5 ;
socle : `2026-09-26-v2-socle-design.md` §4bis).

## Global Constraints

- Branche `feat/v2-socle`. Migrations **364** puis **365** (la dernière appliquée est 363), en-tête
  `-- WHY :` et `-- SCHEMA CHECKED`, testées dans `BEGIN … ROLLBACK`
  (`pnpm dlx supabase db query --linked -f <fichier>`), puis **GO d'Uriel avant chaque**
  `pnpm dlx supabase db push --linked`.
- Toute fonction nouvelle lit `auth.uid()`, ne prend aucun `p_user_id`, est `SECURITY DEFINER`,
  `REVOKE … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated`.
- Visibilité d'un lieu : jamais `masked` ni `private` d'un autre (les siens, si) — la règle de
  `carte_lieux`.
- **Portée de visite : 200 m.** Compagnons : **présents maintenant** (présence de moins de
  10 minutes) **à moins de 200 m du lieu**, montrés seulement à qui est lui-même sur place.
  Revendiquer exige une visite GPS **de moins de 30 minutes**.
- Explore ne fait rien gagner : **ni énergie, ni points, ni Couronnes, ni Cour**.
- Noms publics : `user_public_name(id, display_name, first_name)` — jamais un e-mail.
- Code V2 : `.claude/rules/v2.md` — simplicité, QUOI/POURQUOI, README par dossier, aucune valeur
  visuelle hors `tokens.css`, **tout changement d'état animé** (jetons `--duree-douce`,
  `--courbe-douce`, `--duree-elan`, `--courbe-elan`), `prefers-reduced-motion` respecté. Une
  zone n'importe jamais une autre zone ni `app/`.
- Maquettes Figma (fichier `MKqyVhDPreg06PMEAaDxde`) : fiche `229:128`, états du bouton
  `230:128`, options `231:128`, revendiquer `232:128`, partager `236:128`. Icônes et valeurs
  relevées par `get_design_context` ; une capture à 390 px posée à côté avant de dire « fini ».
- Vocabulaire : « Explorateur », « revendiquer », « expédition », « Envie d'y aller ».

## Review Focus

1. **Lieu inexistant, privé ou masqué d'un autre** → « Ce lieu n'existe pas ou n'est plus
   visible » et le retour, jamais une fiche vide ni une erreur. *Test : Task 1 (SQL) et Task 6.*
2. **Géolocalisation refusée, absente ou lente** → le bouton dit « Position refusée » (ou « Me
   localiser pour visiter ») ; jamais un bouton actif qui échoue ensuite. *Test : Task 4 et 5.*
3. **Visite refusée par le serveur** (trop loin malgré l'écran, réseau coupé) → un message
   clair sous le bouton, la fenêtre de revendication ne s'ouvre pas. *Test : Task 7.*
4. **Compagnon coché qui est parti entre-temps** → ignoré par le serveur, la revendication passe
   quand même avec les autres. *Test : Task 2.*
5. **Lieu sans photo, sans type, sans faits, sans revendication, sans explorateurs** → chaque
   ligne vide disparaît ; la photo cède la place au parchemin et à l'icône du type. *Test : Task 3
   (lecteur) et Task 6.*

---

## Carte des fichiers

```
supabase/migrations/364_fiche_lieu.sql              fiche_lieu, explorateurs_du_lieu, basculer_envie, mes_noms_d_expedition
supabase/tests/v2-lieu/364_fiche.sql                test annulé
supabase/migrations/365_visite_revendication.sql    presences, signaler_presence, visiter_lieu, compagnons_possibles, revendiquer_lieu
supabase/tests/v2-lieu/365_visite.sql               test annulé
apps/web-v2/src/shared/supabase/database.types.ts   régénéré
apps/web-v2/src/app/shell/DetailPane.tsx (+ css)     option « surImage » : la flèche posée sur la photo
apps/web-v2/src/app/routes/lieu.tsx                  RouteLieu (déplacée de carte.tsx)
apps/web-v2/src/app/shell/Shell.tsx                  useSignalerPresence() : la présence tant que l'app est ouverte
apps/web-v2/src/features/carte/components/CarteScreen.tsx   lit ?centre=lat,lng (« Trouver sur la carte »)
apps/web-v2/src/assets/ui/                            pas.svg, drapeau.svg, epingle.svg, signet.svg, signet-plein.svg,
                                                      options.svg, partager-clair.svg, fleche-retour-claire.svg,
                                                      carte-pliee.svg, copier.svg
apps/web-v2/src/features/lieu/
  README.md
  api/lireLieu.ts (+ test)       types et lecture défensive des JSON
  api/lieu.ts                     les appels Supabase
  lib/distance.ts (+ test)        distance (m) entre deux points, et son libellé
  lib/etatVisite.ts (+ test)      l'état du bouton de visite (fonction pure)
  lib/faits.ts (+ test)           la ligne de faits
  hooks/useFiche.ts, useEnvie.ts, usePosition.ts (+ test), useVisite.ts,
  hooks/useRevendication.ts, useSignalerPresence.ts
  components/FicheLieu.tsx (+ test, css)
  components/BoutonVisite.tsx (+ test, css)
  components/FenetreRevendication.tsx (+ test, css)
  components/FeuilleOptions.tsx, FeuillePartager.tsx (+ test, css)
```

---

### Task 1 : lire une fiche (migration 364)

**Files :**
- Create : `supabase/migrations/364_fiche_lieu.sql`, `supabase/tests/v2-lieu/364_fiche.sql`

**Interfaces :**
- Produces (JSON de `fiche_lieu(p_id text)`, ou `null` si introuvable/invisible) :

```json
{ "id": "…", "nom": "…", "recit": "…", "adresse": "…|null", "lat": 45.1, "lng": 6.2,
  "nature": "lieu|curiosite",
  "photos": [{ "url": "…", "vignette": "…" }],
  "type": { "nom": "Château et fortins", "icone": "https://…svg|null", "couleur": "#9b3f39|null" } | null,
  "faits": { "epoque": "Moyen Âge|null", "annee": 1150|null, "saison": null, "acces": "easy|null", "bivouac": null },
  "explorateurs": { "nombre": 3, "derniers": [{ "id": "…", "nom": "…", "avatar": "…|null" }] },
  "revendication": { "nom": "LES LOUPS", "moi": false, "depuis": "2026-09-12T…" } | null,
  "auteur": { "id": "…", "nom": "Luna", "avatar": "…|null" } | null,
  "ajouteLe": "2026-10-17T…",
  "enrichiPar": { "id": "…", "nom": "Mathéo" } | null,
  "moi": { "visiteLe": "2026-08-03T…|null", "envie": true } }
```

- `explorateurs_du_lieu(p_id)` → `[{ id, nom, avatar, visiteLe }]` (le plus récent d'abord) ;
  `basculer_envie(p_id)` → `boolean` (le nouvel état) ; `mes_noms_d_expedition()` → `text[]`
  (distincts, les plus récents d'abord, 8 au plus).

- [ ] **Step 1 : relire le schéma live** (règle `.claude/rules/supabase.md`) :

```bash
pnpm dlx supabase db query --linked "select table_name, column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('places','place_tags','tags','eras','place_explorers','place_veille','expeditions','expedition_members','places_bookmarked','place_description_revisions','users') order by 1, ordinal_position"
```

Expected : les colonnes citées dans le `SCHEMA CHECKED` ci-dessous existent toutes (vérifié le
28/09 : `places.images` = `[{id,url,thumb}]`, `place_explorers.visited_at` NOT NULL défaut
`now()`, `places_bookmarked.id` varchar sans défaut, `place_veille` clé `place_id`).

- [ ] **Step 2 : le test d'abord** — `supabase/tests/v2-lieu/364_fiche.sql` :

```sql
-- 364 : la fiche d'un lieu. Annulé.
BEGIN;
\ir ../../migrations/364_fiche_lieu.sql
DO $test$
DECLARE
  moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  public_id text; prive_autre text; f json; envie1 boolean; envie2 boolean; noms text[];
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  SELECT p.id INTO public_id FROM places p
   WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE AND jsonb_array_length(p.images) > 1
     AND EXISTS (SELECT 1 FROM place_veille v WHERE v.place_id = p.id) LIMIT 1;
  SELECT p.id INTO prive_autre FROM places p WHERE (p.private OR p.masked) AND p.author_id <> moi LIMIT 1;
  f := public.fiche_lieu(public_id);
  envie1 := public.basculer_envie(public_id);
  envie2 := public.basculer_envie(public_id);
  noms := public.mes_noms_d_expedition();
  RAISE EXCEPTION 'BILAN nom=% photos=% type=% explorateurs=% revendication=% moi=% prive_autre=% inconnu=% envie=%/% noms=% liste=%',
    f->>'nom', json_array_length(f->'photos'), f->'type'->>'nom', f->'explorateurs'->>'nombre',
    f->'revendication'->>'nom', f->'moi', public.fiche_lieu(prive_autre), public.fiche_lieu('n-existe-pas'),
    envie1, envie2, cardinality(noms), json_array_length(public.explorateurs_du_lieu(public_id));
END $test$;
ROLLBACK;
```

- [ ] **Step 3 :** `pnpm dlx supabase db query --linked -f supabase/tests/v2-lieu/364_fiche.sql`
  → **FAIL** : `function public.fiche_lieu(text) does not exist` (la migration n'existe pas).

- [ ] **Step 4 : la migration** — `supabase/migrations/364_fiche_lieu.sql` :

```sql
-- 364 — La fiche d'un lieu (lecture) et « Envie d'y aller »
--
-- WHY : spec 2026-09-28-v2-fiche-lieu-design.md §2-3, §7. Une lecture unique rend tout ce que
-- la fiche affiche, avec l'état de celui qui regarde (visité quand, envie) ; la même visibilité
-- que carte_lieux (363). « Envie d'y aller » écrit places_bookmarked, que le profil lit déjà.
-- Toutes lisent auth.uid() ; aucune ne prend d'identifiant de joueur.
--
-- SCHEMA CHECKED (28/09/2026) : places(id, title, text, address, latitude, longitude, author_id,
--   private, masked, images jsonb [{id,url,thumb}], era_id, year_exact, best_season,
--   accessibility, bivouac, nature, created_at) ; place_tags(place_id, tag_id, is_primary) ;
--   tags(id, title, icon, color) ; eras(id, name) ; place_explorers(place_id, user_id,
--   visited_at NOT NULL défaut now(), unique(place_id,user_id)) ; place_veille(place_id pk,
--   expedition_id, veilleur_user_id, planted_at) ; expeditions(id, title, created_at) ;
--   expedition_members(expedition_id, user_id) ; places_bookmarked(id varchar sans défaut,
--   created_at, updated_at, user_id, place_id) ; place_description_revisions(place_id,
--   edited_by, created_at) ; users(id, display_name, first_name, avatar_url) ;
--   user_public_name(p_user_id text, p_display_name text, p_first_name text).

CREATE OR REPLACE FUNCTION public._lieu_visible(p_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM places p
    WHERE p.id = p_id
      AND ((p.masked IS NOT TRUE AND p.private IS NOT TRUE) OR p.author_id = (auth.uid())::text));
$$;
REVOKE ALL ON FUNCTION public._lieu_visible(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fiche_lieu(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'id', l.id,
    'nom', l.title,
    'recit', COALESCE(l.text, ''),
    'adresse', NULLIF(btrim(l.address), ''),
    'lat', l.latitude,
    'lng', l.longitude,
    'nature', l.nature,
    'photos', COALESCE((
      SELECT json_agg(json_build_object('url', i->>'url', 'vignette', COALESCE(i->>'thumb', i->>'url')))
      FROM jsonb_array_elements(COALESCE(l.images, '[]'::jsonb)) i
      WHERE i->>'url' IS NOT NULL), '[]'::json),
    'type', (
      SELECT json_build_object('nom', t.title, 'icone', t.icon, 'couleur', t.color)
      FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE pt.place_id = l.id AND pt.is_primary LIMIT 1),
    'faits', json_build_object(
      'epoque', (SELECT e.name FROM eras e WHERE e.id = l.era_id),
      'annee', l.year_exact,
      'saison', NULLIF(btrim(l.best_season), ''),
      'acces', NULLIF(btrim(l.accessibility), ''),
      'bivouac', NULLIF(btrim(l.bivouac), '')),
    'explorateurs', json_build_object(
      'nombre', (SELECT count(*) FROM place_explorers e WHERE e.place_id = l.id),
      'derniers', COALESCE((
        SELECT json_agg(d.x) FROM (
          SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url) AS x
          FROM place_explorers e JOIN users u ON u.id = e.user_id
          WHERE e.place_id = l.id ORDER BY e.visited_at DESC LIMIT 3) d), '[]'::json)),
    -- La pilule : l'expédition si elle a un nom, sinon le dernier qui l'a revendiqué (comme 363).
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name)),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id),
        'depuis', v.planted_at)
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = l.id AND l.nature = 'lieu'),
    'auteur', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url)
      FROM users u WHERE u.id = l.author_id),
    'ajouteLe', l.created_at,
    'enrichiPar', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name))
      FROM place_description_revisions r JOIN users u ON u.id = r.edited_by
      WHERE r.place_id = l.id AND r.edited_by IS DISTINCT FROM l.author_id
      ORDER BY r.created_at DESC LIMIT 1),
    'moi', json_build_object(
      'visiteLe', (SELECT e.visited_at FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id),
      'envie', EXISTS (SELECT 1 FROM places_bookmarked b WHERE b.place_id = l.id AND b.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
$$;
REVOKE ALL ON FUNCTION public.fiche_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiche_lieu(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.explorateurs_du_lieu(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url, 'visiteLe', e.visited_at) ORDER BY e.visited_at DESC), '[]'::json)
  FROM place_explorers e JOIN users u ON u.id = e.user_id
  WHERE e.place_id = p_id AND public._lieu_visible(p_id);
$$;
REVOKE ALL ON FUNCTION public.explorateurs_du_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.explorateurs_du_lieu(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.basculer_envie(p_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM places_bookmarked WHERE user_id = v_moi AND place_id = p_id;
  IF FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO places_bookmarked (id, created_at, updated_at, user_id, place_id)
  VALUES (gen_random_uuid()::text, now(), now(), v_moi, p_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.basculer_envie(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.basculer_envie(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mes_noms_d_expedition()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(n.titre ORDER BY n.recent DESC), '{}')
  FROM (
    SELECT btrim(x.title) AS titre, max(x.created_at) AS recent
    FROM expedition_members m JOIN expeditions x ON x.id = m.expedition_id
    WHERE m.user_id = (auth.uid())::text AND NULLIF(btrim(x.title), '') IS NOT NULL
    GROUP BY btrim(x.title)
    ORDER BY recent DESC
    LIMIT 8) n;
$$;
REVOKE ALL ON FUNCTION public.mes_noms_d_expedition() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_noms_d_expedition() TO authenticated;
```

- [ ] **Step 5 :** relancer le test.
  Expected : `BILAN nom=<un nom> photos=≥2 type=<un type> explorateurs=<n> revendication=<nom> moi={"visiteLe":…,"envie":false} prive_autre=<NULL> inconnu=<NULL> envie=t/f noms=<n> liste=<n>`.

- [ ] **Step 6 : GO d'Uriel**, puis `pnpm dlx supabase db push --linked` ; relancer le test sur la
  prod (il reste annulé). **Commit** `feat(db): la fiche d'un lieu - fiche_lieu, explorateurs, envie, noms d'expedition (364, appliquee)`.

---

### Task 2 : visiter, être présent, revendiquer (migration 365)

**Files :**
- Create : `supabase/migrations/365_visite_revendication.sql`, `supabase/tests/v2-lieu/365_visite.sql`

**Interfaces :**
- Produces : `signaler_presence(p_lat float8, p_lng float8) → void` ;
  `visiter_lieu(p_id text, p_lat float8, p_lng float8) → json { "visiteLe": "…" }` (refus :
  `ERRCODE P0001`, message « Trop loin ») ; `compagnons_possibles(p_id text) → json [{ id, nom,
  avatar, distance }]` (distance en mètres, arrondie à 10) ; `revendiquer_lieu(p_id text,
  p_compagnons text[], p_nom text) → json { "nom": "…" }` (refus « Visite trop ancienne » P0001,
  « Nom d'expédition manquant » 22023).

- [ ] **Step 1 : relire la définition live de `plant_flag`** (ce qu'une revendication écrit) :

```bash
pnpm dlx supabase db query --linked "select pg_get_functiondef('public.plant_flag(text,text,numeric,numeric,text[],text)'::regprocedure)"
```

Expected : elle écrit `expeditions` (faction, neutre, titre), `expedition_members`,
`place_veille` (`expedition_id`, `veilleur_user_id`, `planted_at`, `faction_id`, `is_neutral`,
`by_influence`, `previous_expedition_id`), `veille_history`, et touche la Cour
(`place_court_action`, `place_court_score`) et `activity_log`. **La V2 reprend les quatre
premières, pas la Cour** (spec §5).

- [ ] **Step 2 : le test d'abord** — `supabase/tests/v2-lieu/365_visite.sql`. Deux comptes réels,
  un lieu public ; on simule leurs positions.

```sql
-- 365 : visiter, être présent, revendiquer. Annulé.
BEGIN;
\ir ../../migrations/365_visite_revendication.sql
DO $test$
DECLARE
  a text; b text; c text; lieu record; loin_ok boolean := false; tard_ok boolean := false;
  comp json; comp_loin json; r json; pilule text;
BEGIN
  SELECT id INTO a FROM users WHERE id = 'cb16ff47-1ead-4adf-8eff-04d117551541';
  SELECT id INTO b FROM users WHERE id <> a ORDER BY created_at LIMIT 1;
  SELECT id INTO c FROM users WHERE id NOT IN (a, b) ORDER BY created_at LIMIT 1;
  SELECT id, latitude AS lat, longitude AS lng INTO lieu FROM places
   WHERE masked IS NOT TRUE AND private IS NOT TRUE AND nature = 'lieu' AND latitude IS NOT NULL LIMIT 1;

  -- B est là (à ~40 m), C est parti (présence vieille de 11 min).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.signaler_presence(lieu.lat + 0.00036, lieu.lng);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM public.signaler_presence(lieu.lat, lieu.lng);
  UPDATE presences SET vu_a = now() - interval '11 minutes' WHERE user_id = c;

  -- A : trop loin (250 m) → refus ; puis à 150 m → visite.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.visiter_lieu(lieu.id, lieu.lat + 0.00225, lieu.lng);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN loin_ok := true;
  END;
  PERFORM public.visiter_lieu(lieu.id, lieu.lat + 0.00135, lieu.lng);
  comp := public.compagnons_possibles(lieu.id);
  r := public.revendiquer_lieu(lieu.id, ARRAY[b, c], 'Les Loups de Test');
  SELECT COALESCE(NULLIF(x.title, ''), '?') INTO pilule FROM place_veille v JOIN expeditions x ON x.id = v.expedition_id WHERE v.place_id = lieu.id;

  -- A s'éloigne : la liste des compagnons lui est fermée.
  PERFORM public.signaler_presence(lieu.lat + 0.01, lieu.lng);
  comp_loin := public.compagnons_possibles(lieu.id);

  -- Une visite vieille de 40 minutes ne permet plus de revendiquer.
  UPDATE place_explorers SET visited_at = now() - interval '40 minutes' WHERE place_id = lieu.id AND user_id = a;
  BEGIN
    PERFORM public.revendiquer_lieu(lieu.id, '{}', NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN tard_ok := true;
  END;

  RAISE EXCEPTION 'BILAN refus_loin=% compagnons=% revendication=% pilule=% membres=% liste_si_loin=% refus_tard=% decouvert_gps=%',
    loin_ok, comp, r, pilule,
    (SELECT count(*) FROM expedition_members m JOIN place_veille v ON v.expedition_id = m.expedition_id WHERE v.place_id = lieu.id),
    comp_loin, tard_ok,
    (SELECT method FROM places_discovered WHERE user_id = a AND place_id = lieu.id);
END $test$;
ROLLBACK;
```

- [ ] **Step 3 :** lancer le test → **FAIL** : `function public.signaler_presence(…) does not exist`.

- [ ] **Step 4 : la migration** — `supabase/migrations/365_visite_revendication.sql` :

```sql
-- 365 — Visiter en GPS, être présent, revendiquer
--
-- WHY : spec 2026-09-28-v2-fiche-lieu-design.md §4-6. Le serveur juge la portée (200 m) ; la
-- présence en direct sert à une seule chose : proposer comme compagnons les Explorateurs qui
-- sont là maintenant, et seulement à qui est lui-même sur place. Une position par Explorateur,
-- écrasée, oubliée après 10 minutes, jamais lue directement. Revendiquer écrit ce que plant_flag
-- (V1) écrit pour une veille — expédition, membres, place_veille, veille_history — sans la Cour,
-- sans points ni Couronnes : la V1 affichera la même revendication.
--
-- SCHEMA CHECKED (28/09/2026) : places(id, latitude, longitude, nature) ; place_explorers
--   (place_id, user_id, visited_at, unique(place_id,user_id)) ; places_discovered(user_id,
--   place_id, method, discovered_at, pk(user_id,place_id)) ; expeditions(id uuid défaut,
--   place_id, is_neutral, faction_id, created_at, title) ; expedition_members(expedition_id,
--   user_id, faction_id, pk) ; place_veille(place_id pk, expedition_id, faction_id, is_neutral,
--   planted_at, by_influence, previous_expedition_id, veilleur_user_id) ; veille_history
--   (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at) ; users(id,
--   faction_id, display_name, first_name, avatar_url) ; PostGIS dans le schéma extensions.

CREATE TABLE IF NOT EXISTS public.presences (
  user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  vu_a timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.presences FROM anon, authenticated;

-- Distance en mètres entre deux points (sphère), pour la portée et les compagnons.
CREATE OR REPLACE FUNCTION public._distance_m(p_lat1 float8, p_lng1 float8, p_lat2 float8, p_lng2 float8)
RETURNS float8
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT ST_DistanceSphere(ST_MakePoint(p_lng1, p_lat1), ST_MakePoint(p_lng2, p_lat2));
$$;
REVOKE ALL ON FUNCTION public._distance_m(float8, float8, float8, float8) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.signaler_presence(p_lat float8, p_lng float8)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  INSERT INTO presences (user_id, latitude, longitude, vu_a)
  VALUES ((auth.uid())::text, p_lat, p_lng, now())
  ON CONFLICT (user_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, vu_a = now();
  DELETE FROM presences WHERE vu_a < now() - interval '10 minutes';
END;
$$;
REVOKE ALL ON FUNCTION public.signaler_presence(float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_presence(float8, float8) TO authenticated;

CREATE OR REPLACE FUNCTION public.visiter_lieu(p_id text, p_lat float8, p_lng float8)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_lieu record;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT id, latitude, longitude INTO v_lieu FROM places WHERE id = p_id AND public._lieu_visible(p_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF public._distance_m(p_lat, p_lng, v_lieu.latitude, v_lieu.longitude) > 200 THEN
    RAISE EXCEPTION 'Trop loin' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (p_id, v_moi, now())
  ON CONFLICT (place_id, user_id) DO UPDATE SET visited_at = now();
  INSERT INTO places_discovered (user_id, place_id, method, discovered_at) VALUES (v_moi, p_id, 'gps', now())
  ON CONFLICT (user_id, place_id) DO UPDATE SET method = 'gps';
  PERFORM public.signaler_presence(p_lat, p_lng);
  RETURN json_build_object('visiteLe', now());
END;
$$;
REVOKE ALL ON FUNCTION public.visiter_lieu(text, float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visiter_lieu(text, float8, float8) TO authenticated;

-- Les présents à moins de 200 m du lieu — montrés seulement à qui y est lui-même, maintenant.
CREATE OR REPLACE FUNCTION public._presents_autour(p_id text)
RETURNS TABLE (user_id text, distance float8)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pr.user_id, public._distance_m(pr.latitude, pr.longitude, l.latitude, l.longitude)
  FROM presences pr, places l
  WHERE l.id = p_id
    AND pr.vu_a > now() - interval '10 minutes'
    AND public._distance_m(pr.latitude, pr.longitude, l.latitude, l.longitude) <= 200;
$$;
REVOKE ALL ON FUNCTION public._presents_autour(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compagnons_possibles(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url, 'distance', round(a.distance / 10) * 10) ORDER BY a.distance), '[]'::json)
  FROM public._presents_autour(p_id) a JOIN users u ON u.id = a.user_id
  WHERE a.user_id <> (auth.uid())::text
    AND public._lieu_visible(p_id)
    AND EXISTS (SELECT 1 FROM public._presents_autour(p_id) m WHERE m.user_id = (auth.uid())::text);
$$;
REVOKE ALL ON FUNCTION public.compagnons_possibles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compagnons_possibles(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revendiquer_lieu(p_id text, p_compagnons text[], p_nom text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_valides text[];
  v_nom text := NULLIF(btrim(p_nom), '');
  v_faction text;
  v_expedition uuid;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND nature = 'lieu' AND public._lieu_visible(p_id)) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM place_explorers
    WHERE place_id = p_id AND user_id = v_moi AND visited_at > now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'Visite trop ancienne' USING ERRCODE = 'P0001';
  END IF;

  -- Seuls comptent les compagnons présents maintenant : les autres sont ignorés.
  SELECT COALESCE(array_agg(a.user_id), '{}') INTO v_valides
  FROM public._presents_autour(p_id) a
  WHERE a.user_id = ANY (COALESCE(p_compagnons, '{}')) AND a.user_id <> v_moi;
  IF cardinality(v_valides) > 0 AND v_nom IS NULL THEN
    RAISE EXCEPTION 'Nom d''expédition manquant' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_valides) = 0 THEN
    v_nom := NULL; -- seul : la pilule porte son nom
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_moi;
  INSERT INTO expeditions (place_id, is_neutral, faction_id, title)
  VALUES (p_id, v_faction IS NULL, v_faction, v_nom)
  RETURNING id INTO v_expedition;
  INSERT INTO expedition_members (expedition_id, user_id, faction_id)
  SELECT v_expedition, u.id, u.faction_id FROM users u WHERE u.id = ANY (v_valides || v_moi);

  INSERT INTO place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_id, v_expedition, v_faction, v_faction IS NULL, now(), false, NULL, v_moi)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = now(), by_influence = false,
    previous_expedition_id = NULL, veilleur_user_id = v_moi;
  INSERT INTO veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  VALUES (p_id, v_expedition, v_moi, v_faction, v_faction IS NULL, now());

  RETURN json_build_object('nom', COALESCE(v_nom,
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi)));
END;
$$;
REVOKE ALL ON FUNCTION public.revendiquer_lieu(text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revendiquer_lieu(text, text[], text) TO authenticated;
```

- [ ] **Step 5 :** relancer le test.
  Expected : `BILAN refus_loin=t compagnons=[{"id":<b>,…,"distance":40}] revendication={"nom" : "Les Loups de Test"} pilule=Les Loups de Test membres=2 liste_si_loin=[] refus_tard=t decouvert_gps=gps`
  (C, parti, n'apparaît ni dans les compagnons ni dans les membres).

- [ ] **Step 6 : GO d'Uriel**, `pnpm dlx supabase db push --linked`, test relancé sur la prod.
  Puis `pnpm --filter web-v2 gen:types` (types régénérés). **Commit**
  `feat(db): visiter en GPS, presence, compagnons, revendiquer (365, appliquee)`.

---

### Task 3 : lire les réponses et parler à la base (zone `features/lieu`)

**Files :**
- Create : `apps/web-v2/src/features/lieu/README.md`, `api/lireLieu.ts` (+ `lireLieu.test.ts`),
  `api/lieu.ts`, `api/README.md`

**Interfaces :**
- Produces :

```ts
export type Personne = { id: string; nom: string; avatar: string | null }
export type FicheLieu = {
  id: string; nom: string; recit: string; adresse: string | null; lat: number; lng: number
  photos: { url: string; vignette: string }[]
  type: { nom: string; icone: string | null; couleur: string | null } | null
  faits: { epoque: string | null; annee: number | null; saison: string | null; acces: string | null; bivouac: string | null }
  explorateurs: { nombre: number; derniers: Personne[] }
  revendication: { nom: string; moi: boolean; depuis: string } | null
  auteur: Personne | null; ajouteLe: string; enrichiPar: { id: string; nom: string } | null
  moi: { visiteLe: string | null; envie: boolean }
}
export type Compagnon = Personne & { distance: number }
export function lireFiche(json: unknown): FicheLieu | null
export function lireExplorateurs(json: unknown): (Personne & { visiteLe: string })[]
export function lireCompagnons(json: unknown): Compagnon[]
// api/lieu.ts
export function fetchFiche(id: string): Promise<FicheLieu | null>
export function fetchExplorateurs(id: string): Promise<(Personne & { visiteLe: string })[]>
export function basculerEnvie(id: string): Promise<boolean>
export function visiterLieu(id: string, lat: number, lng: number): Promise<string>   // visiteLe
export function signalerPresence(lat: number, lng: number): Promise<void>
export function fetchCompagnons(id: string): Promise<Compagnon[]>
export function fetchNomsExpedition(): Promise<string[]>
export function revendiquerLieu(id: string, compagnons: string[], nom: string | null): Promise<string>  // le nom de la pilule
```

- [ ] **Step 1 : les tests d'abord** — `lireLieu.test.ts` :

```ts
import { expect, test } from 'vitest'
import { lireCompagnons, lireFiche } from './lireLieu'

const COMPLET = {
  id: 'a', nom: 'Château de Jonjeac', recit: 'Un récit.', adresse: 'Jonjeac', lat: 45.9, lng: 6.1,
  nature: 'lieu', photos: [{ url: 'u1', vignette: 'v1' }],
  type: { nom: 'Château et fortins', icone: 'i.svg', couleur: '#9b3f39' },
  faits: { epoque: 'Moyen Âge', annee: 1150, saison: null, acces: 'easy', bivouac: null },
  explorateurs: { nombre: 3, derniers: [{ id: 'u', nom: 'Rémy', avatar: null }] },
  revendication: { nom: 'LES LOUPS', moi: false, depuis: '2026-09-12T10:00:00Z' },
  auteur: { id: 'l', nom: 'Luna', avatar: null }, ajouteLe: '2026-01-01T00:00:00Z',
  enrichiPar: null, moi: { visiteLe: null, envie: true },
}

test('une fiche complète se lit', () => {
  expect(lireFiche(COMPLET)).toMatchObject({ nom: 'Château de Jonjeac', moi: { envie: true }, revendication: { nom: 'LES LOUPS' } })
})

test('un lieu introuvable ou invisible se lit « null »', () => {
  expect(lireFiche(null)).toBeNull()
})

test('un lieu nu reste lisible : pas de photo, de type, de faits, de revendication, ni d’explorateurs', () => {
  const nu = { ...COMPLET, photos: [], type: null, adresse: null, revendication: null, auteur: null,
    faits: { epoque: null, annee: null, saison: null, acces: null, bivouac: null },
    explorateurs: { nombre: 0, derniers: [] } }
  expect(lireFiche(nu)).toMatchObject({ photos: [], type: null, revendication: null, explorateurs: { nombre: 0 } })
})

test('les compagnons portent leur distance', () => {
  expect(lireCompagnons([{ id: 'b', nom: 'Léa', avatar: null, distance: 120 }])[0]?.distance).toBe(120)
})
```

- [ ] **Step 2 :** `pnpm --filter web-v2 test -- lireLieu` → **FAIL** (fichier absent).

- [ ] **Step 3 : `api/lireLieu.ts`** — avec les lecteurs de `@/shared/lib/lire` (`objet`,
  `chaine`, `nombre`, `booleen`, `ouNull`, `liste`) ; `lireFiche(null)` rend `null` ; tout autre
  JSON mal formé lève (la requête passe en erreur et l'écran propose « Réessayer ») :

```ts
/**
 * QUOI     — la forme d'une fiche de lieu, des Explorateurs et des compagnons, lues depuis le
 *            JSON des fonctions 364-365.
 * POURQUOI — rien n'est supposé : chaque champ est prouvé ; `null` veut dire « introuvable ou
 *            invisible », et l'écran le dit.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Personne = { id: string; nom: string; avatar: string | null }
export type Compagnon = Personne & { distance: number }
export type FicheLieu = {
  id: string
  nom: string
  recit: string
  adresse: string | null
  lat: number
  lng: number
  photos: { url: string; vignette: string }[]
  type: { nom: string; icone: string | null; couleur: string | null } | null
  faits: {
    epoque: string | null
    annee: number | null
    saison: string | null
    acces: string | null
    bivouac: string | null
  }
  explorateurs: { nombre: number; derniers: Personne[] }
  revendication: { nom: string; moi: boolean; depuis: string } | null
  auteur: Personne | null
  ajouteLe: string
  enrichiPar: { id: string; nom: string } | null
  moi: { visiteLe: string | null; envie: boolean }
}

function lirePersonne(v: unknown): Personne {
  const p = objet(v)
  return { id: chaine(p.id), nom: chaine(p.nom), avatar: ouNull(chaine)(p.avatar) }
}

function lirePhoto(v: unknown) {
  const p = objet(v)
  return { url: chaine(p.url), vignette: chaine(p.vignette) }
}

function lireType(v: unknown) {
  const t = objet(v)
  return { nom: chaine(t.nom), icone: ouNull(chaine)(t.icone), couleur: ouNull(chaine)(t.couleur) }
}

function lireRevendication(v: unknown) {
  const r = objet(v)
  return { nom: chaine(r.nom), moi: booleen(r.moi), depuis: chaine(r.depuis) }
}

function lireEnrichi(v: unknown) {
  const e = objet(v)
  return { id: chaine(e.id), nom: chaine(e.nom) }
}

export function lireFiche(json: unknown): FicheLieu | null {
  if (json === null) return null
  const f = objet(json)
  const faits = objet(f.faits)
  const explorateurs = objet(f.explorateurs)
  const moi = objet(f.moi)
  return {
    id: chaine(f.id),
    nom: chaine(f.nom),
    recit: chaine(f.recit),
    adresse: ouNull(chaine)(f.adresse),
    lat: nombre(f.lat),
    lng: nombre(f.lng),
    photos: liste(lirePhoto)(f.photos),
    type: ouNull(lireType)(f.type),
    faits: {
      epoque: ouNull(chaine)(faits.epoque),
      annee: ouNull(nombre)(faits.annee),
      saison: ouNull(chaine)(faits.saison),
      acces: ouNull(chaine)(faits.acces),
      bivouac: ouNull(chaine)(faits.bivouac),
    },
    explorateurs: {
      nombre: nombre(explorateurs.nombre),
      derniers: liste(lirePersonne)(explorateurs.derniers),
    },
    revendication: ouNull(lireRevendication)(f.revendication),
    auteur: ouNull(lirePersonne)(f.auteur),
    ajouteLe: chaine(f.ajouteLe),
    enrichiPar: ouNull(lireEnrichi)(f.enrichiPar),
    moi: { visiteLe: ouNull(chaine)(moi.visiteLe), envie: booleen(moi.envie) },
  }
}

export function lireExplorateurs(json: unknown) {
  return liste((v) => ({ ...lirePersonne(v), visiteLe: chaine(objet(v).visiteLe) }))(json)
}

export function lireCompagnons(json: unknown): Compagnon[] {
  return liste((v) => ({ ...lirePersonne(v), distance: nombre(objet(v).distance) }))(json)
}
```

- [ ] **Step 4 : `api/lieu.ts`** — les huit appels, chacun `if (error) throw error` :

```ts
/**
 * QUOI     — tout ce que la fiche d'un lieu demande à Supabase (migrations 364-365).
 * POURQUOI — chaque fonction rend une donnée typée ou lève : jamais un `{ error }` à vérifier
 *            plus loin. Les fonctions de la base lisent `auth.uid()` : on n'envoie jamais qui on est.
 */
import { booleen, chaine, liste, objet } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'
import { lireCompagnons, lireExplorateurs, lireFiche } from './lireLieu'

export async function fetchFiche(id: string) {
  const { data, error } = await supabase.rpc('fiche_lieu', { p_id: id })
  if (error) throw error
  return lireFiche(data)
}

export async function fetchExplorateurs(id: string) {
  const { data, error } = await supabase.rpc('explorateurs_du_lieu', { p_id: id })
  if (error) throw error
  return lireExplorateurs(data)
}

export async function basculerEnvie(id: string) {
  const { data, error } = await supabase.rpc('basculer_envie', { p_id: id })
  if (error) throw error
  return booleen(data)
}

export async function visiterLieu(id: string, lat: number, lng: number) {
  const { data, error } = await supabase.rpc('visiter_lieu', { p_id: id, p_lat: lat, p_lng: lng })
  if (error) throw error
  return chaine(objet(data).visiteLe)
}

export async function signalerPresence(lat: number, lng: number) {
  const { error } = await supabase.rpc('signaler_presence', { p_lat: lat, p_lng: lng })
  if (error) throw error
}

export async function fetchCompagnons(id: string) {
  const { data, error } = await supabase.rpc('compagnons_possibles', { p_id: id })
  if (error) throw error
  return lireCompagnons(data)
}

export async function fetchNomsExpedition() {
  const { data, error } = await supabase.rpc('mes_noms_d_expedition')
  if (error) throw error
  return liste(chaine)(data)
}

export async function revendiquerLieu(id: string, compagnons: string[], nom: string | null) {
  const { data, error } = await supabase.rpc('revendiquer_lieu', {
    p_id: id,
    p_compagnons: compagnons,
    p_nom: nom ?? '',
  })
  if (error) throw error
  return chaine(objet(data).nom)
}
```

- [ ] **Step 5 :** READMEs (`features/lieu/README.md` : la zone, ses dossiers, la spec ;
  `api/README.md` : les deux fichiers) ; ajouter `lieu/` à `features/README.md`.
- [ ] **Step 6 :** tests verts, lint vert. **Commit** `feat(v2): la zone lieu - lire une fiche, parler a la base`.

---

### Task 4 : les règles pures — distance, état du bouton, ligne de faits

**Files :**
- Create : `features/lieu/lib/distance.ts`, `etatVisite.ts`, `faits.ts` (+ un test chacun), `lib/README.md`

**Interfaces :**
- Produces :

```ts
export const PORTEE_M = 200
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number
export function libelleDistance(m: number): string          // « 350 m », « 2,4 km », « 274 km »
export type Position = 'inconnue' | 'refusee' | { lat: number; lng: number }
export type EtatVisite =
  | { kind: 'localiser' } | { kind: 'refusee' }
  | { kind: 'visiter' } | { kind: 'tropLoin'; distance: string }
  | { kind: 'revendiquer' } | { kind: 'visite'; le: string; distance: string }
export function etatVisite(position: Position, lieu: { lat: number; lng: number }, visiteLe: string | null): EtatVisite
export function ligneDeFaits(f: FicheLieu['faits']): string | null
```

- [ ] **Step 1 : les tests d'abord.**

`distance.test.ts` :

```ts
import { expect, test } from 'vitest'
import { distanceM, libelleDistance } from './distance'

test('0,0018° de latitude font à peu près 200 m', () => {
  expect(Math.round(distanceM({ lat: 45, lng: 6 }, { lat: 45.0018, lng: 6 }))).toBeGreaterThan(195)
  expect(Math.round(distanceM({ lat: 45, lng: 6 }, { lat: 45.0018, lng: 6 }))).toBeLessThan(205)
})

test('la distance se dit en mètres sous 1 km, en kilomètres au-delà', () => {
  expect(libelleDistance(349.6)).toBe('350 m')
  expect(libelleDistance(2440)).toBe('2,4 km')
  expect(libelleDistance(274_300)).toBe('274 km')
})
```

`etatVisite.test.ts` :

```ts
import { expect, test } from 'vitest'
import { etatVisite } from './etatVisite'

const lieu = { lat: 45, lng: 6 }
const pres = { lat: 45.0009, lng: 6 }   // ~100 m
const loin = { lat: 47.47, lng: 6 }     // ~274 km

test('sans position, on propose de se localiser ; refusée, on le dit', () => {
  expect(etatVisite('inconnue', lieu, null)).toEqual({ kind: 'localiser' })
  expect(etatVisite('refusee', lieu, '2026-08-03T10:00:00Z')).toEqual({ kind: 'refusee' })
})

test('jamais visité : à portée on visite, loin le bouton dit la distance', () => {
  expect(etatVisite(pres, lieu, null)).toEqual({ kind: 'visiter' })
  expect(etatVisite(loin, lieu, null)).toEqual({ kind: 'tropLoin', distance: '274 km' })
})

test('déjà visité : de retour on revendique, loin on rappelle la visite', () => {
  expect(etatVisite(pres, lieu, '2026-08-03T10:00:00Z')).toEqual({ kind: 'revendiquer' })
  expect(etatVisite(loin, lieu, '2026-08-03T10:00:00Z')).toEqual({ kind: 'visite', le: '3 août', distance: '274 km' })
})
```

`faits.test.ts` :

```ts
import { expect, test } from 'vitest'
import { ligneDeFaits } from './faits'

const vide = { epoque: null, annee: null, saison: null, acces: null, bivouac: null }

test('la ligne ne dit que ce qui est connu', () => {
  expect(ligneDeFaits({ ...vide, epoque: 'Moyen Âge', annee: 1150, acces: 'easy' })).toBe('Moyen Âge · XIIᵉ siècle · accès facile')
  expect(ligneDeFaits({ ...vide, annee: -52 })).toBe('Iᵉʳ siècle av. J.-C.')
})

test('rien de connu : pas de ligne', () => {
  expect(ligneDeFaits(vide)).toBeNull()
})
```

- [ ] **Step 2 :** `pnpm --filter web-v2 test -- distance etatVisite faits` → **FAIL**.

- [ ] **Step 3 : l'implémentation.**

`distance.ts` :

```ts
/**
 * QUOI     — la distance entre deux points (formule de haversine), et son libellé.
 * POURQUOI — le bouton de visite dit la distance avant qu'on le touche ; le serveur refait le
 *            calcul (PostGIS) et reste seul juge.
 */
const RAYON_TERRE_M = 6_371_000
const rad = (deg: number) => (deg * Math.PI) / 180

export const PORTEE_M = 200

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h))
}

export function libelleDistance(m: number) {
  if (m < 1000) return `${String(Math.round(m / 10) * 10)} m`
  if (m < 10_000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`
  return `${String(Math.round(m / 1000))} km`
}
```

`etatVisite.ts` :

```ts
/**
 * QUOI     — l'état du bouton de visite, d'après ma position et ma dernière visite.
 * POURQUOI — le bouton porte son état avant qu'on le touche : le refus est écrit dessus, jamais
 *            découvert par l'échec (spec fiche §4). Une règle pure, testée seule.
 */
import { distanceM, libelleDistance, PORTEE_M } from './distance'

export type Position = 'inconnue' | 'refusee' | { lat: number; lng: number }

export type EtatVisite =
  | { kind: 'localiser' }
  | { kind: 'refusee' }
  | { kind: 'visiter' }
  | { kind: 'tropLoin'; distance: string }
  | { kind: 'revendiquer' }
  | { kind: 'visite'; le: string; distance: string }

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

export function etatVisite(
  position: Position,
  lieu: { lat: number; lng: number },
  visiteLe: string | null,
): EtatVisite {
  if (position === 'inconnue') return { kind: 'localiser' }
  if (position === 'refusee') return { kind: 'refusee' }
  const metres = distanceM(position, lieu)
  const aPortee = metres <= PORTEE_M
  if (visiteLe === null) return aPortee ? { kind: 'visiter' } : { kind: 'tropLoin', distance: libelleDistance(metres) }
  if (aPortee) return { kind: 'revendiquer' }
  return { kind: 'visite', le: JOUR.format(new Date(visiteLe)), distance: libelleDistance(metres) }
}
```

`faits.ts` :

```ts
/**
 * QUOI     — la ligne de faits sous le type : époque, siècle, saison, accès, bivouac.
 * POURQUOI — elle répond aux questions de qui envisage d'y aller ; elle ne dit que ce qui est
 *            connu, et disparaît sinon (spec fiche §2).
 */
import type { FicheLieu } from '../api/lireLieu'

const ACCES: Record<string, string> = { easy: 'accès facile', medium: 'accès moyen', hard: 'accès difficile' }
const SAISONS: Record<string, string> = {
  spring: 'idéal au printemps', summer: 'idéal en été', autumn: 'idéal en automne', winter: 'idéal en hiver',
}

function romain(n: number): string {
  const table: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
    [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let reste = n
  return table.reduce((acc, [valeur, lettres]) => {
    const fois = Math.floor(reste / valeur)
    reste -= fois * valeur
    return acc + lettres.repeat(fois)
  }, '')
}

function siecle(annee: number): string {
  const n = Math.floor((Math.abs(annee) - 1) / 100) + 1
  const ordinal = n === 1 ? 'ᵉʳ' : 'ᵉ'
  return `${romain(n)}${ordinal} siècle${annee < 0 ? ' av. J.-C.' : ''}`
}

export function ligneDeFaits(f: FicheLieu['faits']): string | null {
  const morceaux = [
    f.epoque,
    f.annee === null ? null : siecle(f.annee),
    f.saison === null ? null : (SAISONS[f.saison] ?? f.saison),
    f.acces === null ? null : (ACCES[f.acces] ?? f.acces),
    f.bivouac === null ? null : `bivouac ${f.bivouac}`,
  ].filter((m): m is string => m !== null)
  return morceaux.length > 0 ? morceaux.join(' · ') : null
}
```

- [ ] **Step 4 :** tests verts. *(Les valeurs réelles de `best_season` et `bivouac` sont vides en
  base au 28/09 ; les libellés inconnus s'affichent tels quels.)*
- [ ] **Step 5 :** `lib/README.md`. **Commit** `feat(v2): lieu - distance, etat du bouton de visite, ligne de faits`.

---

### Task 5 : les hooks — fiche, envie, position, visite, revendication, présence

**Files :**
- Create : `features/lieu/hooks/useFiche.ts`, `useEnvie.ts`, `usePosition.ts` (+ `usePosition.test.tsx`),
  `useVisite.ts`, `useRevendication.ts`, `useSignalerPresence.ts`, `hooks/README.md`

**Interfaces :**
- Consumes : Task 3 (`api/lieu.ts`), Task 4 (`Position`).
- Produces :

```ts
export function ficheKey(id: string): readonly ['lieu', string]
export function useFiche(id: string): { fiche: FicheLieu | null | undefined; erreur: boolean; reessayer: () => void }
export function useEnvie(id: string): { basculer: () => void; echec: boolean }
export function usePosition(): { position: Position; demander: () => void }
export function useVisite(id: string): { visiter: (p: { lat: number; lng: number }) => Promise<void>; enCours: boolean; erreur: string | null }
export function useRevendication(id: string, ouverte: boolean): {
  compagnons: Compagnon[]; noms: string[]
  revendiquer: (compagnons: string[], nom: string | null) => Promise<void>; enCours: boolean; erreur: string | null
}
export function useSignalerPresence(): void
```

- [ ] **Step 1 : le test d'abord** — `usePosition.test.tsx` :

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { usePosition } from './usePosition'

afterEach(() => { vi.unstubAllGlobals() })

function geoloc(etat: 'granted' | 'denied' | 'prompt', watch: (ok: (p: GeolocationPosition) => void, ko: (e: { code: number }) => void) => void) {
  vi.stubGlobal('navigator', {
    permissions: { query: () => Promise.resolve({ state: etat, addEventListener: () => {} }) },
    geolocation: { watchPosition: (ok: never, ko: never) => { watch(ok, ko); return 1 }, clearWatch: () => {} },
  })
}

test('position autorisée : elle suit le téléphone', async () => {
  geoloc('granted', (ok) => { ok({ coords: { latitude: 45, longitude: 6 } } as GeolocationPosition) })
  const { result } = renderHook(() => usePosition())
  await act(() => Promise.resolve())
  expect(result.current.position).toEqual({ lat: 45, lng: 6 })
})

test('jamais demandée : « inconnue » ; la demander puis refuser : « refusee »', async () => {
  geoloc('prompt', (_ok, ko) => { ko({ code: 1 }) })
  const { result } = renderHook(() => usePosition())
  await act(() => Promise.resolve())
  expect(result.current.position).toBe('inconnue')
  act(() => { result.current.demander() })
  expect(result.current.position).toBe('refusee')
})

test('sans géolocalisation : « refusee », jamais une erreur', async () => {
  vi.stubGlobal('navigator', {})
  const { result } = renderHook(() => usePosition())
  await act(() => Promise.resolve())
  expect(result.current.position).toBe('refusee')
})
```

- [ ] **Step 2 :** → **FAIL**.

- [ ] **Step 3 : les hooks.**

`usePosition.ts` — on ne demande jamais la position sans geste (« Me localiser pour visiter ») ;
déjà autorisée, on la suit tant que la fiche est ouverte :

```ts
/**
 * QUOI     — ma position, suivie tant que la fiche est ouverte ; ou pourquoi on ne l'a pas.
 * POURQUOI — le bouton de visite change d'état quand on s'approche, sans recharger. On ne
 *            demande la position que sur un geste (« Me localiser pour visiter ») ; déjà
 *            autorisée, on la suit tout de suite.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Position } from '../lib/etatVisite'

export function usePosition(): { position: Position; demander: () => void } {
  const [position, setPosition] = useState<Position>('inconnue')
  const [suivre, setSuivre] = useState(false)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPosition('refusee')
      return
    }
    if (!('permissions' in navigator)) return
    void navigator.permissions.query({ name: 'geolocation' }).then((statut) => {
      if (statut.state === 'granted') setSuivre(true)
      if (statut.state === 'denied') setPosition('refusee')
    })
  }, [])

  useEffect(() => {
    if (!suivre || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({ lat: coords.latitude, lng: coords.longitude })
      },
      () => {
        setPosition('refusee')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
    return () => {
      navigator.geolocation.clearWatch(id)
    }
  }, [suivre])

  const demander = useCallback(() => {
    setSuivre(true)
  }, [])

  return { position, demander }
}
```

*(Le test « la demander puis refuser » passe parce que `watchPosition` du faux appelle `ko`
tout de suite dans l'effet ; si `act` ne suffit pas, attendre avec `waitFor`.)*

`useFiche.ts` :

```ts
/**
 * QUOI     — la fiche d'un lieu, depuis le cache ou la base.
 * POURQUOI — `fiche` vaut `undefined` pendant le chargement, `null` si le lieu est introuvable ou
 *            invisible : l'écran distingue les deux.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchFiche } from '../api/lieu'
import type { FicheLieu } from '../api/lireLieu'

export const ficheKey = (id: string) => ['lieu', id] as const

export function useFiche(id: string): { fiche: FicheLieu | null | undefined; erreur: boolean; reessayer: () => void } {
  const query = useQuery({ queryKey: ficheKey(id), queryFn: () => fetchFiche(id) })
  return {
    fiche: query.data,
    erreur: query.isError,
    reessayer: () => {
      void query.refetch()
    },
  }
}
```

`useEnvie.ts` — optimiste, retour en arrière si la base refuse (le patron de `usePreferences`) :

```ts
/**
 * QUOI     — « Envie d'y aller » : le signet bascule tout de suite ; si la base refuse, il
 *            revient à sa place et `echec` passe à vrai.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { basculerEnvie } from '../api/lieu'
import type { FicheLieu } from '../api/lireLieu'
import { ficheKey } from './useFiche'

export function useEnvie(id: string): { basculer: () => void; echec: boolean } {
  const queryClient = useQueryClient()
  const [echec, setEchec] = useState(false)
  const inverser = () => {
    queryClient.setQueryData<FicheLieu | null>(ficheKey(id), (f) => f && { ...f, moi: { ...f.moi, envie: !f.moi.envie } })
  }
  const mutation = useMutation({
    mutationFn: () => basculerEnvie(id),
    onMutate: async () => {
      setEchec(false)
      await queryClient.cancelQueries({ queryKey: ficheKey(id) })
      inverser()
    },
    onError: () => {
      inverser()
      setEchec(true)
    },
  })
  return {
    basculer: () => {
      mutation.mutate()
    },
    echec,
  }
}
```

`useVisite.ts` — après une visite réussie, la fiche et la carte se relisent (clés `['lieu', id]`
et `['carte', 'lieux']` : la clé de la carte est un contrat écrit, pas un import) :

```ts
/**
 * QUOI     — visiter le lieu en GPS : le serveur juge la portée.
 * POURQUOI — un refus (trop loin, réseau) se dit sous le bouton ; une réussite relit la fiche et
 *            la carte (le sceau devient « visité »). La clé ['carte', 'lieux'] est le contrat
 *            avec la zone Carte (useCarteLieux) : aucune zone n'importe l'autre.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { visiterLieu } from '../api/lieu'
import { ficheKey } from './useFiche'

export function useVisite(id: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (p: { lat: number; lng: number }) => visiterLieu(id, p.lat, p.lng),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
    },
  })
  const erreur = mutation.isError
    ? mutation.error.message === 'Trop loin'
      ? 'Tu es encore trop loin pour marquer ta visite.'
      : 'La visite n’a pas pu être enregistrée. Réessaie dans un instant.'
    : null
  return {
    visiter: async (p: { lat: number; lng: number }) => {
      await mutation.mutateAsync(p)
    },
    enCours: mutation.isPending,
    erreur,
  }
}
```

`useRevendication.ts` — les compagnons ne se lisent que la fenêtre ouverte, et se relisent toutes
les 20 s (on bouge) :

```ts
/**
 * QUOI     — la fenêtre de revendication : qui est là, mes noms d'expédition, revendiquer.
 * POURQUOI — les compagnons sont ceux que le serveur voit présents maintenant ; on relit la liste
 *            toutes les 20 s tant que la fenêtre est ouverte.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCompagnons, fetchNomsExpedition, revendiquerLieu } from '../api/lieu'
import { ficheKey } from './useFiche'

export function useRevendication(id: string, ouverte: boolean) {
  const queryClient = useQueryClient()
  const compagnons = useQuery({
    queryKey: ['lieu', id, 'compagnons'],
    queryFn: () => fetchCompagnons(id),
    enabled: ouverte,
    refetchInterval: 20_000,
  })
  const noms = useQuery({ queryKey: ['expeditions', 'mes-noms'], queryFn: fetchNomsExpedition, enabled: ouverte })
  const mutation = useMutation({
    mutationFn: ({ ids, nom }: { ids: string[]; nom: string | null }) => revendiquerLieu(id, ids, nom),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['expeditions', 'mes-noms'] })
    },
  })
  const erreur = mutation.isError
    ? mutation.error.message === 'Visite trop ancienne'
      ? 'Ta visite date de plus de 30 minutes : marque-la à nouveau sur place.'
      : 'La revendication n’a pas pu être enregistrée. Réessaie dans un instant.'
    : null
  return {
    compagnons: compagnons.data ?? [],
    noms: noms.data ?? [],
    revendiquer: async (ids: string[], nom: string | null) => {
      await mutation.mutateAsync({ ids, nom })
    },
    enCours: mutation.isPending,
    erreur,
  }
}
```

`useSignalerPresence.ts` — monté une fois par la coquille ; ne demande jamais la position :

```ts
/**
 * QUOI     — tant que l'app est ouverte et la position déjà autorisée, signaler sa présence au
 *            serveur au plus une fois par minute.
 * POURQUOI — c'est ce qui permet d'être proposé comme compagnon à qui revendique un lieu à côté
 *            (spec fiche §6). Jamais de demande de permission ici : sans autorisation, rien.
 */
import { useEffect } from 'react'
import { signalerPresence } from '../api/lieu'

const UNE_MINUTE = 60_000

export function useSignalerPresence() {
  useEffect(() => {
    if (!('geolocation' in navigator) || !('permissions' in navigator)) return
    let minuteur: ReturnType<typeof setInterval> | undefined
    const signaler = () => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          void signalerPresence(coords.latitude, coords.longitude).catch(() => undefined)
        },
        () => undefined,
        { maximumAge: UNE_MINUTE, timeout: 15_000 },
      )
    }
    void navigator.permissions.query({ name: 'geolocation' }).then((statut) => {
      if (statut.state !== 'granted') return
      signaler()
      minuteur = setInterval(signaler, UNE_MINUTE)
    })
    return () => {
      clearInterval(minuteur)
    }
  }, [])
}
```

- [ ] **Step 4 :** tests verts, lint vert (le `.catch(() => undefined)` de la présence est voulu :
  un signal perdu ne dérange personne ; commentaire en place).
- [ ] **Step 5 :** `hooks/README.md`. **Commit** `feat(v2): lieu - hooks de la fiche, de la position, de la visite et de la presence`.

---

### Task 6 : la fiche à l'écran

**Files :**
- Modify : `apps/web-v2/src/app/shell/DetailPane.tsx` (+ `.module.css`, + test) — option `surImage`
- Create : `apps/web-v2/src/app/routes/lieu.tsx` ; Modify : `app/routes/carte.tsx` (retirer
  `RouteLieu`), `app/router.tsx`, `app/routes/README.md`
- Create : `features/lieu/components/FicheLieu.tsx` (+ `.module.css`, + `FicheLieu.test.tsx`), `components/README.md`
- Create : `assets/ui/pas.svg`, `drapeau.svg`, `epingle.svg`, `signet.svg`, `signet-plein.svg`,
  `options.svg`, `partager-clair.svg`, `fleche-retour-claire.svg` (+ `assets/ui/README.md`)
- Modify : `tokens.css` (+ `daTokens.ts`) si la maquette a une couleur absente des jetons

**Interfaces :**
- Consumes : Task 3 (`FicheLieu`), Task 4 (`ligneDeFaits`), Task 5 (`useFiche`, `useEnvie`).
- Produces : `export function FicheLieu({ id, onOptions, onPartager, boutonVisite }: { id: string; onOptions: () => void; onPartager: () => void; boutonVisite: (fiche: FicheLieu) => ReactNode })` — la route compose les feuilles et le bouton (Tasks 7-9) ; `DetailPane` gagne `surImage?: boolean`.

- [ ] **Step 1 : relever la maquette** — `get_design_context` sur `229:128` (fichier
  `MKqyVhDPreg06PMEAaDxde`) : valeurs exactes (tailles, couleurs, espacements, bord déchiré
  `0101 1`) et **téléchargement des icônes** : flèche claire (`arrow-left 1`), partage (`share 1`),
  signet (`book-marked 1`), options (`bolt 1`), épingle (`map-pin 1`), pas, drapeau. Les couleurs
  de la maquette : `#786666` (lignes), `#b39b9b` (aides), `#5c5151` (« Le récit »), `#9b3f39`
  (badge par défaut) — chacune doit exister dans `tokens.css` ou y entrer (et sur `/v2/da`).

- [ ] **Step 2 : les tests d'abord** — `FicheLieu.test.tsx` (le `api/lieu` simulé, comme la zone
  Compte) :

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { FicheLieu } from './FicheLieu'

const api = vi.hoisted(() => ({ fetchFiche: vi.fn(), basculerEnvie: vi.fn(() => Promise.resolve(true)) }))
vi.mock('../api/lieu', () => api)

const FICHE = {
  id: 'a', nom: 'Château de Jonjeac', recit: 'Un récit.', adresse: 'Jonjeac', lat: 45.9, lng: 6.1,
  photos: [{ url: 'u1', vignette: 'v1' }, { url: 'u2', vignette: 'v2' }],
  type: { nom: 'Château et fortins', icone: null, couleur: '#9b3f39' },
  faits: { epoque: 'Moyen Âge', annee: 1150, saison: null, acces: null, bivouac: null },
  explorateurs: { nombre: 3, derniers: [] },
  revendication: { nom: 'LES LOUPS', moi: false, depuis: '2026-09-12T10:00:00Z' },
  auteur: { id: 'l', nom: 'Luna', avatar: null }, ajouteLe: '2026-01-01T00:00:00Z',
  enrichiPar: { id: 'm', nom: 'Mathéo' }, moi: { visiteLe: null, envie: false },
}

beforeEach(() => { api.fetchFiche.mockResolvedValue(FICHE) })

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <FicheLieu id="a" onOptions={vi.fn()} onPartager={vi.fn()} boutonVisite={() => <span>bouton</span>} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('la fiche montre le lieu tel que maquetté', async () => {
  afficher()
  expect(await screen.findByRole('heading', { name: 'Château de Jonjeac' })).toBeInTheDocument()
  expect(screen.getByText('Château et fortins')).toBeInTheDocument()
  expect(screen.getByText('Moyen Âge · XIIᵉ siècle')).toBeInTheDocument()
  expect(screen.getByText('3 Explorateurs ont foulé ce lieu')).toBeInTheDocument()
  expect(screen.getByText('LES LOUPS')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Jonjeac/ })).toHaveAttribute('href', expect.stringContaining('45.9,6.1'))
  expect(screen.getByText(/Enrichi par/)).toBeInTheDocument()
})

test('« Envie d’y aller » bascule tout de suite', async () => {
  afficher()
  const signet = await screen.findByRole('button', { name: 'Envie d’y aller' })
  expect(signet).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(signet)
  expect(signet).toHaveAttribute('aria-pressed', 'true')
  expect(api.basculerEnvie).toHaveBeenCalledWith('a')
})

test('un lieu nu n’affiche aucune ligne vide', async () => {
  api.fetchFiche.mockResolvedValue({ ...FICHE, photos: [], type: null, revendication: null, enrichiPar: null,
    faits: { epoque: null, annee: null, saison: null, acces: null, bivouac: null }, explorateurs: { nombre: 0, derniers: [] } })
  afficher()
  expect(await screen.findByText('Personne n’a encore foulé ce lieu')).toBeInTheDocument()
  expect(screen.queryByText(/Revendiqué par/)).toBeNull()
  expect(screen.queryByText(/siècle/)).toBeNull()
})

test('un lieu introuvable le dit', async () => {
  api.fetchFiche.mockResolvedValue(null)
  afficher()
  expect(await screen.findByText('Ce lieu n’existe pas ou n’est plus visible')).toBeInTheDocument()
})
```

- [ ] **Step 3 :** → **FAIL**.

- [ ] **Step 4 : `DetailPane` — `surImage`.** Avec `surImage`, l'en-tête passe par-dessus le
  contenu (position absolue, fond transparent), la flèche est `fleche-retour-claire.svg`, le titre
  reste pour les lecteurs d'écran mais est visuellement masqué, `actions` à droite (le bouton
  partager). Un test dans `DetailPane.test.tsx` : `surImage` → le bouton « Fermer » est là, le
  titre existe (`getByRole('heading', { name })`) et porte la classe masquée.

- [ ] **Step 5 : `FicheLieu.tsx`** — l'ordre exact de la spec §2 : photo (et bord déchiré),
  galerie (toucher une vignette la met en grand), titre `h2` + boutons ronds (`Envie d’y aller`,
  `aria-pressed`, signet plein si coché ; `Options du lieu`), badge (couleur du type en variable
  CSS inline `--type`, autorisée comme `--icone`), `ligneDeFaits`, adresse (lien
  `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`, `target=_blank`), « N
  Explorateurs ont foulé ce lieu » (avatars empilés ; 1 : « 1 Explorateur a foulé ce lieu » ; 0 :
  « Personne n’a encore foulé ce lieu »), « Revendiqué par [pilule] · depuis le 12 sept. » (pilule
  encre pleine si `moi`), `boutonVisite`, « Le récit » + texte, crédits (« Lieu ajouté par Luna · le
  17 octobre 2026 », « Enrichi par Mathéo »). Chargement : un squelette parchemin ; erreur :
  EmptyState + « Réessayer ». Les trois icônes de ligne ont le même trait (maquette).

- [ ] **Step 6 : la route** — `app/routes/lieu.tsx` :

```tsx
/**
 * QUOI     — /<onglet>/lieu/<id> : la fiche dans le cadre de détail, et ses feuilles.
 * POURQUOI — la zone Lieu ne connaît pas la coquille : c'est ici qu'elle reçoit le cadre.
 */
import { useParams } from 'react-router'
import { FicheLieu } from '@/features/lieu/components/FicheLieu'
import { DetailPane } from '../shell/DetailPane'

export function RouteLieu() {
  const { id = '' } = useParams()
  return (
    <DetailPane title="Lieu" surImage>
      <FicheLieu id={id} onOptions={() => undefined} onPartager={() => undefined} boutonVisite={() => null} />
    </DetailPane>
  )
}
```

  (`onOptions`, `onPartager`, `boutonVisite` sont branchés aux Tasks 7-9.) `router.tsx` importe
  `RouteLieu` depuis `./routes/lieu` ; `carte.tsx` perd la sienne (code mort, même commit).

- [ ] **Step 7 :** tests verts, lint vert ; `pnpm dev:v2` → `/v2/carte`, toucher un lieu : la
  fiche, capture à 390 px à côté de `229:128`, chaque écart repris. **Commit**
  `feat(v2): la fiche d'un lieu - photo, faits, explorateurs, revendication, envie`.

---

### Task 7 : le bouton de visite

**Files :** Create `features/lieu/components/BoutonVisite.tsx` (+ `.module.css`, + test) ; Modify
`app/routes/lieu.tsx`.

**Interfaces :**
- Consumes : `etatVisite`, `usePosition`, `useVisite`.
- Produces : `export function BoutonVisite({ fiche, onVisite }: { fiche: Pick<FicheLieu, 'id' | 'lat' | 'lng' | 'moi'>; onVisite: () => void })`
  — `onVisite` est appelé après une visite réussie (et au toucher de « Revendiquer ») : la route
  ouvre la fenêtre (Task 8). La route le passe à `FicheLieu` : `boutonVisite={(f) => <BoutonVisite fiche={f} onVisite={…} />}`.

- [ ] **Step 1 : les tests d'abord** — `BoutonVisite.test.tsx`, `usePosition` et `useVisite`
  simulés :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FicheLieu } from '../api/lireLieu'
import { BoutonVisite } from './BoutonVisite'

const position_ = vi.hoisted(() => vi.fn())
const visite_ = vi.hoisted(() => vi.fn())
vi.mock('../hooks/usePosition', () => ({ usePosition: position_ }))
vi.mock('../hooks/useVisite', () => ({ useVisite: visite_ }))

const visiter = vi.fn(() => Promise.resolve())
const onVisite = vi.fn()

beforeEach(() => {
  visiter.mockClear()
  onVisite.mockClear()
  visite_.mockReturnValue({ visiter, enCours: false, erreur: null })
})

function afficher({ lat, lng, visiteLe }: { lat: number; lng: number; visiteLe: string | null }) {
  const fiche = { id: 'a', lat, lng, moi: { visiteLe, envie: false } } as Pick<FicheLieu, 'id' | 'lat' | 'lng' | 'moi'>
  render(<BoutonVisite fiche={fiche} onVisite={onVisite} />)
}

test.each([
  ['inconnue', null, 'Me localiser pour visiter', true],
  ['refusee', null, 'Position refusée', false],
  [{ lat: 45.0009, lng: 6 }, null, 'Marquer ma visite (GPS)', true],
  [{ lat: 47.465, lng: 6 }, null, 'Marquer ma visite · 274 km trop loin', false],
  [{ lat: 45.0009, lng: 6 }, '2026-08-03T10:00:00Z', 'Revendiquer', true],
  [{ lat: 47.465, lng: 6 }, '2026-08-03T10:00:00Z', '✓ Visité le 3 août · 274 km', false],
] as const)('position %o, visité %s : « %s »', (position, visiteLe, libelle, actif) => {
  position_.mockReturnValue({ position, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe })
  const bouton = screen.getByRole('button', { name: libelle })
  if (actif) expect(bouton).toBeEnabled()
  else expect(bouton).toBeDisabled()
})

test('à portée, toucher marque la visite puis ouvre la revendication', async () => {
  position_.mockReturnValue({ position: { lat: 45.0009, lng: 6 }, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  await userEvent.click(screen.getByRole('button', { name: 'Marquer ma visite (GPS)' }))
  expect(visiter).toHaveBeenCalledWith({ lat: 45.0009, lng: 6 })
  expect(onVisite).toHaveBeenCalled()
})

test('refus du serveur : le message s’écrit sous le bouton, pas de fenêtre', async () => {
  position_.mockReturnValue({ position: { lat: 45.0009, lng: 6 }, demander: vi.fn() })
  visiter.mockRejectedValueOnce(new Error('Trop loin'))
  visite_.mockReturnValue({ visiter, enCours: false, erreur: 'Tu es encore trop loin pour marquer ta visite.' })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  await userEvent.click(screen.getByRole('button', { name: 'Marquer ma visite (GPS)' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Tu es encore trop loin pour marquer ta visite.')
  expect(onVisite).not.toHaveBeenCalled()
})

test('position refusée : l’aide pour l’autoriser est écrite', () => {
  position_.mockReturnValue({ position: 'refusee', demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  expect(screen.getByText('Autorise la localisation dans les réglages du navigateur pour visiter.')).toBeInTheDocument()
})

test('« Me localiser pour visiter » demande la position', async () => {
  const demander = vi.fn()
  position_.mockReturnValue({ position: 'inconnue', demander })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  await userEvent.click(screen.getByRole('button', { name: 'Me localiser pour visiter' }))
  expect(demander).toHaveBeenCalled()
})
```

  Le composant reçoit donc `fiche: Pick<FicheLieu, 'id' | 'lat' | 'lng' | 'moi'>` (ce dont il se
  sert, pas plus). Au toucher : `visiter(position).then(onVisite, () => undefined)` — l'échec est
  déjà dit par `erreur` (rôle `alert`).

- [ ] **Step 2 :** → **FAIL**. **Step 3 :** l'implémentation — styles de la maquette `230:128`
  (rouge = `--color-accent`, grisé = jetons `--color-desactive-*`, visité = crème) ; le passage
  d'un état à l'autre en fondu (`--duree-douce`). « Me localiser » appelle `demander()`.
  « Revendiquer » : `visiter(position)` puis `onVisite()` (la visite est refaite, spec §4).
- [ ] **Step 4 :** tests verts ; en vrai, à la maison (loin) puis à côté d'un lieu (ou en
  simulant la position dans les outils du navigateur) : les états suivent. **Commit**
  `feat(v2): lieu - le bouton de visite porte son etat`.

---

### Task 8 : la fenêtre de revendication

**Files :** Create `features/lieu/components/FenetreRevendication.tsx` (+ `.module.css`, + test) ;
Modify `app/routes/lieu.tsx` (état local `revendiquer`, ouvert par `onVisite`).

**Interfaces :**
- Consumes : `useRevendication(id, ouverte)`, `Feuille`, `Segments`, `PastilleChoix`, `Champ`, `Button`.
- Produces : `export function FenetreRevendication({ fiche, onFermer }: { fiche: Pick<FicheLieu, 'id' | 'nom'>; onFermer: () => void })`.

- [ ] **Step 1 : les tests d'abord** — `FenetreRevendication.test.tsx`, `useRevendication` simulé :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Compagnon } from '../api/lireLieu'
import { FenetreRevendication } from './FenetreRevendication'

const revendication_ = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useRevendication', () => ({ useRevendication: revendication_ }))

const revendiquer = vi.fn(() => Promise.resolve())
const onFermer = vi.fn()

beforeEach(() => {
  revendiquer.mockClear()
  onFermer.mockClear()
})

function afficher({ compagnons, noms, erreur = null }: { compagnons: Compagnon[]; noms: string[]; erreur?: string | null }) {
  revendication_.mockReturnValue({ compagnons, noms, revendiquer, enCours: false, erreur })
  render(<FenetreRevendication fiche={{ id: 'a', nom: 'Château de Jonjeac' }} onFermer={onFermer} />)
}

const REMY: Compagnon = { id: 'b', nom: 'Rémy', avatar: null, distance: 40 }

test('seul : « Revendiquer » n’envoie ni compagnon ni nom', async () => {
  afficher({ compagnons: [], noms: [] })
  await userEvent.click(screen.getByRole('radio', { name: 'En expédition' }))
  expect(screen.getByText('Personne d’autre n’est ici en ce moment')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'Seul' }))
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(revendiquer).toHaveBeenCalledWith([], null)
})

test('en expédition : je coche un compagnon présent et je choisis un nom passé', async () => {
  afficher({ compagnons: [REMY], noms: ['Les Loups'] })
  await userEvent.click(screen.getByRole('radio', { name: 'En expédition' }))
  expect(screen.getByText('à 40 m')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: /Rémy/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Les Loups' }))
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(revendiquer).toHaveBeenCalledWith(['b'], 'Les Loups')
})

test('en expédition sans nom : « Revendiquer » attend un nom', async () => {
  afficher({ compagnons: [REMY], noms: [] })
  await userEvent.click(screen.getByRole('radio', { name: 'En expédition' }))
  await userEvent.click(screen.getByRole('checkbox', { name: /Rémy/ }))
  expect(screen.getByRole('button', { name: 'Revendiquer' })).toBeDisabled()
})

test('« Pas maintenant » ferme sans revendiquer', async () => {
  afficher({ compagnons: [], noms: [] })
  await userEvent.click(screen.getByRole('button', { name: 'Pas maintenant' }))
  expect(onFermer).toHaveBeenCalled()
  expect(revendiquer).not.toHaveBeenCalled()
})

test('réussite : la fenêtre se ferme', async () => {
  afficher({ compagnons: [], noms: [] })
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(onFermer).toHaveBeenCalled()
})

test('échec : le message est écrit, la fenêtre reste', async () => {
  revendiquer.mockRejectedValueOnce(new Error('Visite trop ancienne'))
  afficher({ compagnons: [], noms: [], erreur: 'Ta visite date de plus de 30 minutes : marque-la à nouveau sur place.' })
  await userEvent.click(screen.getByRole('button', { name: 'Revendiquer' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Ta visite date de plus de 30 minutes')
  expect(onFermer).not.toHaveBeenCalled()
})
```

  Le composant reçoit `fiche: Pick<FicheLieu, 'id' | 'nom'>`. `Segments` expose ses choix en
  `radio` (vérifié : `role="radiogroup"` et des `<input type="radio">`).

- [ ] **Step 2 :** → **FAIL**. **Step 3 :** l'implémentation, maquette `232:128` : titre « Revendiquer
  ce lieu », le texte « Tu es au … pour la gloire… », `Segments` Seul / En expédition, « Qui est avec
  toi ? » + « Les Explorateurs ici en ce moment, à moins de 200 m. », une ligne par compagnon
  (avatar, nom, « à 40 m », case à cocher), `Champ` « Nom de l’expédition », les noms passés en
  `PastilleChoix` (toucher = remplir le champ), `Button` « Revendiquer » (désactivé en expédition
  avec un compagnon coché et sans nom), « Pas maintenant ». Seul, ou en expédition sans compagnon
  coché → `revendiquer([], null)`.
- [ ] **Step 4 :** tests verts. **Commit** `feat(v2): lieu - la fenetre de revendication, seul ou en expedition`.

---

### Task 9 : options, partage, « Trouver sur la carte », et la présence

**Files :** Create `features/lieu/components/FeuilleOptions.tsx`, `FeuillePartager.tsx`
(+ `.module.css`, + `Feuilles.test.tsx`), `assets/ui/carte-pliee.svg`, `copier.svg` ; Modify
`app/routes/lieu.tsx`, `features/carte/components/CarteScreen.tsx` (+ test), `app/shell/Shell.tsx`.

**Interfaces :**
- Produces : `FeuilleOptions({ fiche, onFermer })` et `FeuillePartager({ fiche, onFermer })`, avec
  `fiche: Pick<FicheLieu, 'id' | 'nom' | 'lat' | 'lng' | 'type' | 'photos'>`. Options : une ligne « Trouver sur la carte » qui
  navigue vers `/carte?centre=<lat>,<lng>` ; `FeuillePartager({ fiche, onFermer })` — l'aperçu,
  « Copier le lien » (`navigator.clipboard.writeText(location.origin + '/v2/carte/lieu/' + id)`,
  puis « Lien copié » 2 s), « Partager ailleurs… » seulement si `'share' in navigator`
  (`navigator.share({ title, url })`).
- `CarteScreen` : si l'adresse porte `?centre=lat,lng`, la carte y vole (`flyTo`, zoom 14) une
  fois chargée, puis retire le paramètre (`replace`).

- [ ] **Step 1 : les tests d'abord** — `Feuilles.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { FeuilleOptions } from './FeuilleOptions'
import { FeuillePartager } from './FeuillePartager'

const FICHE = { id: 'a', nom: 'Château de Jonjeac', lat: 45.9, lng: 6.1, type: { nom: 'Château et fortins', icone: null, couleur: null }, photos: [] }

afterEach(() => { vi.unstubAllGlobals() })

function dans(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: ['/carte/lieu/a'] })
  render(<RouterProvider router={router} />)
  return router
}

test('« Trouver sur la carte » mène à la carte centrée sur le lieu', async () => {
  const router = dans(<FeuilleOptions fiche={FICHE} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Trouver sur la carte/ }))
  expect(router.state.location.pathname).toBe('/carte')
  expect(router.state.location.search).toBe('?centre=45.9,6.1')
})

test('« Copier le lien » copie l’adresse de la fiche et le dit', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Copier le lien/ }))
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/v2/carte/lieu/a`)
  expect(await screen.findByText('Lien copié')).toBeInTheDocument()
})

test('avec le partage natif, « Partager ailleurs… » l’ouvre', async () => {
  const share = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /Partager ailleurs/ }))
  expect(share).toHaveBeenCalledWith({ title: 'Château de Jonjeac', url: `${window.location.origin}/v2/carte/lieu/a` })
})

test('sans partage natif, « Partager ailleurs… » n’apparaît pas', () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } })
  dans(<FeuillePartager fiche={FICHE} onFermer={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /Partager ailleurs/ })).toBeNull()
})
```

  Les deux feuilles reçoivent `fiche: Pick<FicheLieu, 'id' | 'nom' | 'lat' | 'lng' | 'type' | 'photos'>`.

  Et dans `CarteScreen.test.tsx` (la fausse carte de `src/test/`) :

```tsx
test('?centre=lat,lng : la carte vole jusqu’au lieu une fois chargée', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/carte?centre=45.9,6.1']}>
        <CarteScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  charger()
  expect(carte().flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [6.1, 45.9], zoom: 14 }))
})
```

- [ ] **Step 2 :** → **FAIL**. **Step 3 :** l'implémentation, maquettes `231:128` et `236:128`
  (le style de la feuille « Ajouter » : `Feuille`, lignes crème bordées, icône 24 px, chevron). La
  route compose : `onOptions` / `onPartager` ouvrent chacune sa feuille (état local),
  `boutonVisite={(f) => <BoutonVisite fiche={f} onVisite={…} />}`, la fenêtre de revendication.
  `Shell.tsx` appelle `useSignalerPresence()` (la zone Lieu signale la présence, la coquille la
  monte une fois).
- [ ] **Step 4 :** tests verts, lint vert, `pnpm build` OK. **Commit**
  `feat(v2): lieu - options, partage, trouver sur la carte, presence`.

---

## Après la dernière tâche

- `pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 build` → vert.
- `pnpm dev:v2`, **fenêtre au premier plan** : toucher un lieu depuis la carte (mobile 390 px et
  PC, tiroir) ; envie ; partager ; options → trouver sur la carte ; le bouton de visite en simulant
  la position (outils du navigateur → Sensors) : loin, à portée, visiter, la fenêtre, revendiquer
  seul ; la pilule change sur la carte. Chaque écran posé à côté de sa maquette.
- Revue finale de toute la branche par un relecteur neuf, puis push.
- Vault (`_État.md`) : ce qui a été tranché en route.
