# Les Compagnies — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** des Compagnies simples (fiche, devise, couleur, canal dans La Communauté, Chef et Officiers nommés,
publiques ou privées, fondées par les Porteurs), les 8 Compagnies V1 reprises, la revendication « pour » une
Compagnie.

**Architecture :** on garde les tables V1 (`factions`, `faction_members`, `chat_messages`) et on y ajoute
ce qui manque ; toute écriture passe par des fonctions SECURITY DEFINER qui lisent `auth.uid()`. Le Registre
passe de deux canaux fixes à des canaux dynamiques (`general`, `bugs`, et l'id de chaque Compagnie dont je
suis membre), lus par une fonction `mes_canaux()`. Le front ajoute une zone `features/compagnies` (pages
liste, fiche, gérer, fonder) ; La Communauté, la revendication, la fiche d'un lieu, le profil et les
notifications reçoivent de petits ajouts.

**Tech Stack :** Postgres/Supabase (plpgsql), React 19, React Router, TanStack Query 5, CSS modules + jetons,
Vitest + jsdom.

**Spec :** `docs/superpowers/specs/2026-10-05-v2-compagnies-design.md` (maquettes Figma « Compagnies — 1 à
8 », fichier `MKqyVhDPreg06PMEAaDxde`).

## Global Constraints

- pnpm ; `pnpm dlx supabase` ; TS strict (pas de `any`, `@ts-ignore`, `as unknown as`).
- Migrations : `-- WHY:` + `SCHEMA CHECKED` ; tout `CREATE OR REPLACE` part de la définition live
  (`scratchpad/live.py` : `live('public.f(args)')`) ; test `BEGIN … RAISE EXCEPTION 'BILAN %' … ROLLBACK` ;
  Uriel applique (`pnpm dlx supabase db push --linked`), puis `pnpm --filter web-v2 gen:types`.
- Scripts SQL et éditions multi-lignes en fichiers Python dans le scratchpad (pas de heredoc bash).
- Noms d'utilisateur : `user_public_name(u.id, u.display_name, u.first_name)`.
- V2 : en-tête `QUOI / POURQUOI` par fichier, `README.md` par dossier ; CSS : jetons seulement (stylelint) ;
  les zones ne s'importent pas entre elles (partagé → `shared/`) ; images distantes par `aLaTaille`.
- Mots : « Compagnie », « Chef / Cheffe », « Officier / Officière » (défauts), « Fonder une Compagnie »,
  « Rejoindre la Compagnie », « Demander à rejoindre », « Demande envoyée », « Ouvrir le canal », « Quitter
  la Compagnie », « Gérer la Compagnie », « Passer la main à un autre Chef… », « ＋ Compagnies », « Leurs
  lieux », « Pour une Compagnie (facultatif) », « C'est réservé aux Porteurs », « Découvrir la boutique › »,
  « Déjà client ? Ton Fragment rejoint le compte de l'e-mail de ta commande. »
- Limites : nom 2 à 40 signes, unique sans casse ; devise 80 ; mission 500 ; nom de rôle 30 ; message 500.
- Porteur = `EXISTS (SELECT 1 FROM user_fragments f JOIN title_fragments tf ON tf.id = f.fragment_id AND
  tf.visible WHERE f.user_id = <moi>)` (la règle de `porteurVerifie`).
- La couleur d'une Compagnie ne s'affiche jamais sur la carte. Sur le parchemin, son encre est la couleur
  plafonnée en clarté par la syntaxe relative de CSS : `oklch(from var(--couleur) min(l, 0.45) c h)`.
- Conventional Commits ; fin : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Livraison : version Pythéas bumpée, `pnpm build`, parcours testé dans le navigateur, déploiement V2 puis V1
  (V1 depuis `apps/explore-web`, `.claude/rules/deploiement.md`).

## Review Focus

1. **Un non-membre lit le canal d'une Compagnie privée** (par `registre` ou par le temps réel) → refusé : la
   fonction filtre par appartenance, et la policy `chat_read_faction` (mig 297) protège le temps réel. Test
   SQL Tâche 3.
2. **Le dernier Chef quitte la Compagnie** → la main passe à l'officier le plus ancien, sinon au membre le
   plus ancien ; une Compagnie sans membre est retirée (`retired = true`), pas supprimée. Test SQL Tâche 2.
3. **Deux personnes fondent en même temps une Compagnie au même nom** (casse différente) → la seconde reçoit
   `nom_pris` (index unique `lower(title)` sur les Compagnies non retirées). Test SQL Tâche 1.
4. **Je quitte une Compagnie alors que sa gélule est cochée** → la gélule disparaît, le choix gardé l'oublie,
   le champ revient au Général. Test Vitest Tâche 4.
5. **Une couleur V1 très claire (blanc)** → texte lisible : l'encre est plafonnée en clarté par le CSS
   (`oklch(from var(--couleur) min(l, 0.45) c h)`). Test Vitest Tâche 4 (la gélule reçoit `--couleur`) ;
   vérifié à l'œil Tâche 9 (palette de « Gérer », dernière couleur `#eaeae6`).

---

### Tâche 1 : migration 420 — les colonnes, les demandes, la reprise des 8 Compagnies

**Files :** Create `supabase/migrations/420_compagnies_v2.sql` (via `scratchpad/mig420.py`), `scratchpad/test420.sql`.

**Interfaces — Produces :**
`factions.privee boolean`, `factions.devise text`, `factions.chef_m/chef_f/officier_m/officier_f text` ;
`faction_members.role text ('chef'|'officier'|'membre')` ; table `demandes_compagnie(faction_id text,
user_id text, mot text, cree_le timestamptz, PK(faction_id, user_id))` ; `expeditions.pour_compagnie text`,
`place_veille.pour_compagnie text` ; `_est_porteur(p_user text) boolean` ; `_role_compagnie(p_id text,
p_user text) text` (NULL si non-membre) ; index unique `factions_nom_unique ON factions (lower(title)) WHERE
NOT retired`.

- [ ] **Étape 1 : test (doit échouer : colonnes absentes)** — `scratchpad/test420_bloc.sql` :

```sql
DO $t$ DECLARE b text; BEGIN
  SELECT 'actives=' || (SELECT count(*) FROM factions WHERE NOT retired)
    || ' chefs=' || (SELECT count(*) FROM faction_members m JOIN factions f ON f.id = m.faction_id WHERE NOT f.retired AND m.role = 'chef')
    || ' sans_chef=' || (SELECT count(*) FROM factions f WHERE NOT f.retired
         AND NOT EXISTS (SELECT 1 FROM faction_members m WHERE m.faction_id = f.id AND m.role = 'chef'))
    || ' privees=' || (SELECT count(*) FROM factions WHERE privee)
    || ' lys=' || (SELECT chef_m || '/' || chef_f || '/' || officier_m || '/' || officier_f FROM factions WHERE title = 'Le Lys de Fer')
  INTO b;
  BEGIN
    INSERT INTO factions (id, title, color) VALUES ('f-test-doublon', 'le lys de fer', '#000000');
    b := b || ' doublon=PASSE';
  EXCEPTION WHEN unique_violation THEN b := b || ' doublon=refuse';
  END;
  RAISE EXCEPTION 'BILAN %', b;
END $t$;
```

Run (sans la migration) : `BEGIN; <bloc> ROLLBACK;` → Expected : ERREUR `column "role" does not exist`.

- [ ] **Étape 2 : la migration**

```sql
-- WHY: Compagnies V2 (spec 2026-10-05-v2-compagnies-design) : publiques ou privées, une devise, deux rôles
--      nommés (masculin/féminin), un rôle par membre, des demandes, la revendication « pour » une
--      Compagnie ; les 5 Compagnies retirées restent retirées, les 8 actives sont reprises (un Chef chacune,
--      publiques, libellés de grades V1 repris quand ils existent).
-- SCHEMA CHECKED (05/10/2026) : factions(id, title, color, description, image_url, created_by, retired…) ;
--      faction_members(faction_id, user_id, joined_at, is_founder…) ; faction_grade_labels(faction_id, rank,
--      label_m, label_f, label_n, capacity) ; expeditions(id, place_id, faction_id, title…) ;
--      place_veille(place_id, expedition_id…) ; user_fragments(user_id, fragment_id) ; title_fragments(id, visible).

ALTER TABLE public.factions
  ADD COLUMN privee boolean NOT NULL DEFAULT false,
  ADD COLUMN devise text,
  ADD COLUMN chef_m text NOT NULL DEFAULT 'Chef',
  ADD COLUMN chef_f text NOT NULL DEFAULT 'Cheffe',
  ADD COLUMN officier_m text NOT NULL DEFAULT 'Officier',
  ADD COLUMN officier_f text NOT NULL DEFAULT 'Officière';
ALTER TABLE public.faction_members
  ADD COLUMN role text NOT NULL DEFAULT 'membre' CHECK (role IN ('chef', 'officier', 'membre'));
CREATE UNIQUE INDEX factions_nom_unique ON public.factions (lower(title)) WHERE NOT retired;

CREATE TABLE public.demandes_compagnie (
  faction_id text NOT NULL REFERENCES public.factions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mot text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (faction_id, user_id)
);
ALTER TABLE public.demandes_compagnie ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demandes_compagnie FROM PUBLIC, anon, authenticated;

ALTER TABLE public.expeditions ADD COLUMN pour_compagnie text REFERENCES public.factions(id) ON DELETE SET NULL;
ALTER TABLE public.place_veille ADD COLUMN pour_compagnie text REFERENCES public.factions(id) ON DELETE SET NULL;

CREATE FUNCTION public._est_porteur(p_user text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT EXISTS (SELECT 1 FROM user_fragments f JOIN title_fragments tf ON tf.id = f.fragment_id AND tf.visible
                 WHERE f.user_id = p_user);
$function$;
REVOKE ALL ON FUNCTION public._est_porteur(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public._role_compagnie(p_id text, p_user text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT m.role FROM faction_members m JOIN factions f ON f.id = m.faction_id
  WHERE m.faction_id = p_id AND m.user_id = p_user AND NOT f.retired;
$function$;
REVOKE ALL ON FUNCTION public._role_compagnie(text, text) FROM PUBLIC, anon, authenticated;

-- La reprise : un Chef par Compagnie active (le fondateur ; sinon le créateur s'il est membre ; sinon le
-- plus ancien), et les libellés des deux premiers grades V1 quand la Compagnie les a nommés.
UPDATE public.faction_members m SET role = 'chef'
FROM (
  SELECT DISTINCT ON (fm.faction_id) fm.faction_id, fm.user_id
  FROM faction_members fm JOIN factions f ON f.id = fm.faction_id
  WHERE NOT f.retired
  ORDER BY fm.faction_id, fm.is_founder DESC NULLS LAST, (fm.user_id = f.created_by) DESC NULLS LAST, fm.joined_at
) c
WHERE m.faction_id = c.faction_id AND m.user_id = c.user_id;

UPDATE public.factions f SET
  chef_m = COALESCE(NULLIF(btrim(g1.label_m), ''), f.chef_m),
  chef_f = COALESCE(NULLIF(btrim(g1.label_f), ''), NULLIF(btrim(g1.label_m), ''), f.chef_f),
  officier_m = COALESCE(NULLIF(btrim(g2.label_m), ''), f.officier_m),
  officier_f = COALESCE(NULLIF(btrim(g2.label_f), ''), NULLIF(btrim(g2.label_m), ''), f.officier_f)
FROM (SELECT DISTINCT ON (faction_id) * FROM faction_grade_labels ORDER BY faction_id, rank DESC) g1
LEFT JOIN LATERAL (SELECT * FROM faction_grade_labels g WHERE g.faction_id = g1.faction_id AND g.rank < g1.rank
                   ORDER BY g.rank DESC LIMIT 1) g2 ON true
WHERE g1.faction_id = f.id AND NOT f.retired;
```

(Vérifier d'abord, en lecture, le sens de `rank` dans `faction_grade_labels` : `SELECT * FROM
faction_grade_labels ORDER BY faction_id, rank` ; si le grade le plus haut a le plus petit `rank`, inverser
les deux ordres — ruling au journal.)

- [ ] **Étape 3 : test** — `BEGIN; <migration> <bloc> ROLLBACK;`
Expected : `BILAN actives=8 chefs=8 sans_chef=0 privees=0 lys=<libellés repris ou Chef/Cheffe/Officier/Officière> doublon=refuse`.

- [ ] **Étape 4 : commit** (Uriel applique avec les migrations 421 et 422, Tâche 3).

```bash
git add supabase/migrations/420_compagnies_v2.sql
git commit -m "feat(db): Compagnies V2 — devise, prive, roles nommes, demandes, reprise des 8 Compagnies (mig 420)"
```

---

### Tâche 2 : migration 421 — vivre une Compagnie (lire, fonder, rejoindre, gérer)

**Files :** Create `supabase/migrations/421_compagnies_fonctions.sql`, `scratchpad/test421_bloc.sql`.

**Interfaces — Produces (toutes `SECURITY DEFINER`, `GRANT EXECUTE … TO authenticated`) :**
- `compagnies()` → `json` : `{ porteur: boolean, miennes: Carte[], autres: Carte[] }` avec `Carte = { id, nom,
  devise, couleur, avatar, privee, membres:int, role: 'chef'|'officier'|'membre'|null, demandee:boolean }`.
- `compagnie(p_id text)` → `json | null` : `{ id, nom, devise, mission, couleur, avatar, privee, fondeeLe,
  roles: {chefM, chefF, officierM, officierF}, monRole, demandee, membres: [{id, nom, avatar, role, genre:
  'm'|'f'}], lieux: [{id, nom, par, quand}], demandes: [{id, nom, avatar, mot, quand}] (Chef/Officiers ;
  sinon []) }`. `null` : retirée, introuvable.
- `fonder_compagnie(p_nom, p_devise, p_mission, p_couleur, p_avatar, p_privee)` → `json {id}`.
- `modifier_compagnie(p_id, p_nom, p_devise, p_mission, p_couleur, p_avatar, p_privee, p_chef_m, p_chef_f,
  p_officier_m, p_officier_f)` → `void` (les rôles : Chef seulement ; NULL = inchangé).
- `rejoindre_compagnie(p_id, p_mot text DEFAULT NULL)` → `json {etat: 'membre'|'demande'}`.
- `repondre_demande(p_id, p_user, p_oui boolean)` → `void`.
- `quitter_compagnie(p_id)` → `void`.
- `changer_role(p_id, p_user, p_role text)` → `void` (`'officier'|'membre'` : Chef ; `'chef'` : le Chef passe
  la main, il devient officier).
- `retirer_membre(p_id, p_user)` → `void` (Chef ou Officier ; jamais le Chef).
- Indices de refus (`HINT`) : `connexion`, `porteur`, `nom`, `nom_pris`, `introuvable`, `role`, `deja`.
- Notifications : `demande_compagnie` (à chaque Chef/Officier, data `{actorId, actorName, compagnieId,
  compagnieNom}`), `demande_acceptee` (au demandeur, data `{actorId, actorName, compagnieId, compagnieNom}`).

- [ ] **Étape 1 : le test qui échoue** — `scratchpad/test421_bloc.sql` (deux comptes : un Porteur et un non-Porteur) :

```sql
DO $t$
DECLARE b text := ''; porteur text; autre text; x json; c text;
BEGIN
  SELECT f.user_id INTO porteur FROM user_fragments f JOIN title_fragments tf ON tf.id = f.fragment_id AND tf.visible
  WHERE f.user_id ~ '^[0-9a-f-]{36}$' LIMIT 1;
  SELECT u.id INTO autre FROM users u WHERE u.id ~ '^[0-9a-f-]{36}$' AND NOT public._est_porteur(u.id) LIMIT 1;
  -- non-Porteur : refusé
  PERFORM set_config('request.jwt.claims', json_build_object('sub', autre, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.fonder_compagnie('Test Antenne', 'Une devise', 'Une mission', '#4f7a4a', NULL, true); b := 'fonder_autre=PASSE';
  EXCEPTION WHEN others THEN b := 'fonder_autre=' || COALESCE(NULLIF(PG_EXCEPTION_HINT, ''), SQLERRM); END;
  -- Porteur : fonde une privée
  PERFORM set_config('request.jwt.claims', json_build_object('sub', porteur, 'role', 'authenticated')::text, true);
  x := public.fonder_compagnie('Test Antenne', 'Une devise', 'Une mission', '#4f7a4a', NULL, true);
  c := x->>'id';
  b := b || ' role_fondateur=' || public._role_compagnie(c, porteur);
  -- l'autre demande, n'est pas membre, ne voit pas les demandes
  PERFORM set_config('request.jwt.claims', json_build_object('sub', autre, 'role', 'authenticated')::text, true);
  b := b || ' rejoindre=' || (public.rejoindre_compagnie(c, 'Coucou')->>'etat')
    || ' membre_avant=' || COALESCE(public._role_compagnie(c, autre), 'non')
    || ' demandes_vues=' || json_array_length(public.compagnie(c)->'demandes');
  -- le Chef accepte
  PERFORM set_config('request.jwt.claims', json_build_object('sub', porteur, 'role', 'authenticated')::text, true);
  PERFORM public.repondre_demande(c, autre, true);
  b := b || ' membre_apres=' || public._role_compagnie(c, autre)
    || ' notif=' || (SELECT count(*) FROM notifications WHERE recipient_id = autre AND type = 'demande_acceptee');
  -- passer la main
  PERFORM public.changer_role(c, autre, 'chef');
  b := b || ' chef=' || public._role_compagnie(c, autre) || '/' || public._role_compagnie(c, porteur);
  -- un officier ne renomme pas les rôles
  BEGIN PERFORM public.modifier_compagnie(c, NULL, NULL, NULL, NULL, NULL, NULL, 'Grand', NULL, NULL, NULL); b := b || ' renommer_officier=PASSE';
  EXCEPTION WHEN others THEN b := b || ' renommer_officier=' || PG_EXCEPTION_HINT; END;
  -- le nouveau Chef part : la main revient à l'officier restant
  PERFORM set_config('request.jwt.claims', json_build_object('sub', autre, 'role', 'authenticated')::text, true);
  PERFORM public.quitter_compagnie(c);
  b := b || ' apres_depart=' || public._role_compagnie(c, porteur);
  -- le dernier part : la Compagnie est retirée
  PERFORM set_config('request.jwt.claims', json_build_object('sub', porteur, 'role', 'authenticated')::text, true);
  PERFORM public.quitter_compagnie(c);
  b := b || ' retiree=' || (SELECT retired FROM factions WHERE id = c)::text
    || ' liste=' || json_array_length(public.compagnies()->'autres');
  RAISE EXCEPTION 'BILAN %', b;
END $t$;
```

`GET DIAGNOSTICS`/`PG_EXCEPTION_HINT` : utiliser `GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT` dans
chaque `EXCEPTION` (déclarer `v_hint text`) — l'écriture ci-dessus est l'intention ; le script la met en
forme valide.

Run sans 421 (avec 420) → Expected : ERREUR `function public.fonder_compagnie(...) does not exist`.

- [ ] **Étape 2 : la migration** — les fonctions. Code complet :

```sql
-- WHY: les gestes d'une Compagnie V2 (spec compagnies) : lire la liste et la fiche, fonder (Porteurs),
--      rejoindre (publique) ou demander (privée), répondre, quitter, nommer, passer la main, retirer.
-- SCHEMA CHECKED (05/10/2026) : migration 420 ; notify(text, text, jsonb) ; users.title_gender ; users.faction_id.

CREATE FUNCTION public._carte_compagnie(f public.factions, p_moi text) RETURNS json LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT json_build_object('id', f.id, 'nom', f.title, 'devise', f.devise, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee,
    'membres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
    'role', public._role_compagnie(f.id, p_moi),
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = p_moi));
$function$;
REVOKE ALL ON FUNCTION public._carte_compagnie(public.factions, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.compagnies() RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'porteur', public._est_porteur(moi.id),
    'miennes', COALESCE((SELECT json_agg(public._carte_compagnie(f, moi.id) ORDER BY f.title)
                         FROM factions f WHERE NOT f.retired AND public._role_compagnie(f.id, moi.id) IS NOT NULL), '[]'),
    'autres', COALESCE((SELECT json_agg(public._carte_compagnie(f, moi.id)
                                        ORDER BY (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) DESC, f.title)
                        FROM factions f WHERE NOT f.retired AND public._role_compagnie(f.id, moi.id) IS NULL), '[]'))
  FROM moi WHERE moi.id IS NOT NULL;
$function$;

CREATE FUNCTION public.compagnie(p_id text) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  r AS (SELECT public._role_compagnie(p_id, moi.id) AS role FROM moi)
  SELECT json_build_object(
    'id', f.id, 'nom', f.title, 'devise', f.devise, 'mission', f.description, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee, 'fondeeLe', f.created_at,
    'roles', json_build_object('chefM', f.chef_m, 'chefF', f.chef_f, 'officierM', f.officier_m, 'officierF', f.officier_f),
    'monRole', r.role,
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = moi.id),
    'membres', COALESCE((SELECT json_agg(json_build_object('id', u.id,
        'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url, 'role', m.role,
        'genre', CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END)
        ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at)
      FROM faction_members m JOIN users u ON u.id = m.user_id WHERE m.faction_id = f.id), '[]'),
    'lieux', COALESCE((SELECT json_agg(json_build_object('id', l.id, 'nom', l.title, 'par', l.par, 'quand', l.quand) ORDER BY l.quand DESC)
      FROM (SELECT DISTINCT ON (x.place_id) p.id, p.title, x.created_at AS quand,
              COALESCE(NULLIF(x.title, ''), (SELECT user_public_name(u.id, u.display_name, u.first_name)
                FROM expedition_members em JOIN users u ON u.id = em.user_id WHERE em.expedition_id = x.id LIMIT 1)) AS par
            FROM expeditions x JOIN places p ON p.id = x.place_id
            WHERE x.pour_compagnie = f.id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
            ORDER BY x.place_id, x.created_at DESC) l), '[]'),
    'demandes', CASE WHEN r.role IN ('chef', 'officier') THEN COALESCE((SELECT json_agg(json_build_object(
        'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url,
        'mot', d.mot, 'quand', d.cree_le) ORDER BY d.cree_le)
      FROM demandes_compagnie d JOIN users u ON u.id = d.user_id WHERE d.faction_id = f.id), '[]') ELSE '[]'::json END)
  FROM factions f, moi, r
  WHERE f.id = p_id AND NOT f.retired AND moi.id IS NOT NULL;
$function$;
```

(Vérifier la valeur réelle de `users.title_gender` pour le féminin — `SELECT DISTINCT title_gender FROM
users` — et ajuster `'f'` si c'est `'feminin'` ; ruling au journal.)

```sql
CREATE FUNCTION public._refus(p_message text, p_hint text) RETURNS void LANGUAGE plpgsql AS $function$
BEGIN RAISE EXCEPTION '%', p_message USING ERRCODE = 'P0001', HINT = p_hint; END;
$function$;

CREATE FUNCTION public._verifier_fiche(p_nom text, p_devise text, p_mission text, p_couleur text)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF p_nom IS NOT NULL AND char_length(btrim(p_nom)) NOT BETWEEN 2 AND 40 THEN PERFORM public._refus('Un nom de 2 à 40 signes', 'nom'); END IF;
  IF char_length(p_devise) > 80 THEN PERFORM public._refus('Une devise de 80 signes au plus', 'nom'); END IF;
  IF char_length(p_mission) > 500 THEN PERFORM public._refus('Une mission de 500 signes au plus', 'nom'); END IF;
  IF p_couleur IS NOT NULL AND p_couleur !~ '^#[0-9a-fA-F]{6}$' THEN PERFORM public._refus('Une couleur #rrggbb', 'nom'); END IF;
END;
$function$;

CREATE FUNCTION public.fonder_compagnie(p_nom text, p_devise text, p_mission text, p_couleur text, p_avatar text, p_privee boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text; v_id text := 'f-' || substr(md5(random()::text), 1, 12);
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connexion requise', 'connexion'); END IF;
  IF NOT _est_porteur(v_moi) THEN PERFORM _refus('Fonder est réservé aux Porteurs', 'porteur'); END IF;
  PERFORM _verifier_fiche(p_nom, p_devise, p_mission, COALESCE(p_couleur, '#5f6f86'));
  BEGIN
    INSERT INTO factions (id, title, devise, description, color, image_url, privee, created_by)
    VALUES (v_id, btrim(p_nom), NULLIF(btrim(p_devise), ''), NULLIF(btrim(p_mission), ''),
            COALESCE(p_couleur, '#5f6f86'), p_avatar, COALESCE(p_privee, false), v_moi);
  EXCEPTION WHEN unique_violation THEN PERFORM _refus('Ce nom est déjà pris', 'nom_pris');
  END;
  INSERT INTO faction_members (faction_id, user_id, joined_at, is_founder, role) VALUES (v_id, v_moi, now(), true, 'chef');
  INSERT INTO chat_messages (channel, user_id, user_name, content)
  SELECT v_id, v_moi, user_public_name(u.id, u.display_name, u.first_name), 'La Compagnie est fondée.' FROM users u WHERE u.id = v_moi;
  RETURN json_build_object('id', v_id);
END;
$function$;
```

(Avant d'écrire `INSERT INTO factions` : `SELECT column_name, is_nullable, column_default FROM
information_schema.columns WHERE table_name = 'factions'` — toute colonne `NOT NULL` sans défaut (`order`,
`pattern`…) reçoit la valeur que lui donne la création V1 `create_faction` (lire sa définition live). Le
format de l'id suit celui des Compagnies V1 (`f-` + 12 caractères, ex. `f-218977ad85aa`).)

```sql
CREATE FUNCTION public.modifier_compagnie(p_id text, p_nom text, p_devise text, p_mission text, p_couleur text,
  p_avatar text, p_privee boolean, p_chef_m text, p_chef_f text, p_officier_m text, p_officier_f text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text; v_role text := _role_compagnie(p_id, v_moi);
BEGIN
  IF v_role IS NULL OR v_role = 'membre' THEN PERFORM _refus('Réservé au Chef et aux Officiers', 'role'); END IF;
  IF v_role <> 'chef' AND COALESCE(p_chef_m, p_chef_f, p_officier_m, p_officier_f) IS NOT NULL THEN
    PERFORM _refus('Seul le Chef nomme les rôles', 'role');
  END IF;
  IF greatest(char_length(p_chef_m), char_length(p_chef_f), char_length(p_officier_m), char_length(p_officier_f)) > 30 THEN
    PERFORM _refus('Un nom de rôle de 30 signes au plus', 'nom');
  END IF;
  PERFORM _verifier_fiche(p_nom, p_devise, p_mission, p_couleur);
  BEGIN
    UPDATE factions SET
      title = COALESCE(NULLIF(btrim(p_nom), ''), title),
      devise = CASE WHEN p_devise IS NULL THEN devise ELSE NULLIF(btrim(p_devise), '') END,
      description = CASE WHEN p_mission IS NULL THEN description ELSE NULLIF(btrim(p_mission), '') END,
      color = COALESCE(p_couleur, color), image_url = COALESCE(p_avatar, image_url),
      privee = COALESCE(p_privee, privee),
      chef_m = COALESCE(NULLIF(btrim(p_chef_m), ''), chef_m), chef_f = COALESCE(NULLIF(btrim(p_chef_f), ''), chef_f),
      officier_m = COALESCE(NULLIF(btrim(p_officier_m), ''), officier_m),
      officier_f = COALESCE(NULLIF(btrim(p_officier_f), ''), officier_f),
      updated_at = now()
    WHERE id = p_id;
  EXCEPTION WHEN unique_violation THEN PERFORM _refus('Ce nom est déjà pris', 'nom_pris');
  END;
  -- Devenue publique : les demandes en attente deviennent des membres.
  IF p_privee IS FALSE THEN
    INSERT INTO faction_members (faction_id, user_id, joined_at, role)
    SELECT faction_id, user_id, now(), 'membre' FROM demandes_compagnie WHERE faction_id = p_id ON CONFLICT DO NOTHING;
    DELETE FROM demandes_compagnie WHERE faction_id = p_id;
  END IF;
END;
$function$;

CREATE FUNCTION public.rejoindre_compagnie(p_id text, p_mot text DEFAULT NULL) RETURNS json LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text; f factions; v_nom text; v_qui text;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connexion requise', 'connexion'); END IF;
  SELECT * INTO f FROM factions WHERE id = p_id AND NOT retired;
  IF NOT FOUND THEN PERFORM _refus('Compagnie introuvable', 'introuvable'); END IF;
  IF _role_compagnie(p_id, v_moi) IS NOT NULL THEN PERFORM _refus('Déjà membre', 'deja'); END IF;
  IF NOT f.privee THEN
    INSERT INTO faction_members (faction_id, user_id, joined_at, role) VALUES (p_id, v_moi, now(), 'membre');
    -- La V1 n'a qu'une Compagnie active : la première rejointe le devient si on n'en a pas.
    UPDATE users SET faction_id = p_id WHERE id = v_moi AND faction_id IS NULL;
    RETURN json_build_object('etat', 'membre');
  END IF;
  INSERT INTO demandes_compagnie (faction_id, user_id, mot) VALUES (p_id, v_moi, NULLIF(left(btrim(p_mot), 200), ''))
  ON CONFLICT (faction_id, user_id) DO UPDATE SET mot = EXCLUDED.mot, cree_le = now();
  BEGIN
    SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
    FOR v_qui IN SELECT user_id FROM faction_members WHERE faction_id = p_id AND role IN ('chef', 'officier') LOOP
      PERFORM notify(v_qui, 'demande_compagnie', jsonb_build_object('actorId', v_moi, 'actorName', v_nom,
        'compagnieId', p_id, 'compagnieNom', f.title));
    END LOOP;
  EXCEPTION WHEN others THEN RAISE WARNING 'rejoindre_compagnie : notification en échec (%)', SQLERRM;
  END;
  RETURN json_build_object('etat', 'demande');
END;
$function$;

CREATE FUNCTION public.repondre_demande(p_id text, p_user text, p_oui boolean) RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text;
BEGIN
  IF COALESCE(_role_compagnie(p_id, v_moi), 'membre') = 'membre' THEN PERFORM _refus('Réservé au Chef et aux Officiers', 'role'); END IF;
  DELETE FROM demandes_compagnie WHERE faction_id = p_id AND user_id = p_user;
  IF NOT FOUND THEN RETURN; END IF; -- déjà traitée par un autre officier
  IF p_oui THEN
    INSERT INTO faction_members (faction_id, user_id, joined_at, role) VALUES (p_id, p_user, now(), 'membre') ON CONFLICT DO NOTHING;
    UPDATE users SET faction_id = p_id WHERE id = p_user AND faction_id IS NULL;
    BEGIN
      PERFORM notify(p_user, 'demande_acceptee', jsonb_build_object('actorId', v_moi,
        'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi),
        'compagnieId', p_id, 'compagnieNom', (SELECT title FROM factions WHERE id = p_id)));
    EXCEPTION WHEN others THEN RAISE WARNING 'repondre_demande : notification en échec (%)', SQLERRM;
    END;
  END IF;
END;
$function$;

-- Le Chef parti (ou retiré) : la main passe à l'officier le plus ancien, sinon au membre le plus ancien ;
-- sans membre, la Compagnie est retirée.
CREATE FUNCTION public._succession(p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_id AND role = 'chef') THEN RETURN; END IF;
  UPDATE faction_members SET role = 'chef' WHERE (faction_id, user_id) = (
    SELECT faction_id, user_id FROM faction_members WHERE faction_id = p_id
    ORDER BY (role = 'officier') DESC, joined_at LIMIT 1);
  IF NOT FOUND THEN UPDATE factions SET retired = true WHERE id = p_id; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._succession(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.quitter_compagnie(p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text;
BEGIN
  DELETE FROM faction_members WHERE faction_id = p_id AND user_id = v_moi;
  UPDATE users SET faction_id = NULL WHERE id = v_moi AND faction_id = p_id; -- la V1 suit
  PERFORM _succession(p_id);
END;
$function$;

CREATE FUNCTION public.changer_role(p_id text, p_user text, p_role text) RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text;
BEGIN
  IF _role_compagnie(p_id, v_moi) IS DISTINCT FROM 'chef' THEN PERFORM _refus('Réservé au Chef', 'role'); END IF;
  IF p_user = v_moi OR _role_compagnie(p_id, p_user) IS NULL OR p_role NOT IN ('chef', 'officier', 'membre') THEN
    PERFORM _refus('Rôle impossible', 'role');
  END IF;
  IF p_role = 'chef' THEN
    UPDATE faction_members SET role = 'officier' WHERE faction_id = p_id AND user_id = v_moi;
  END IF;
  UPDATE faction_members SET role = p_role WHERE faction_id = p_id AND user_id = p_user;
END;
$function$;

CREATE FUNCTION public.retirer_membre(p_id text, p_user text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE v_moi text := (auth.uid())::text; v_role text := _role_compagnie(p_id, p_user);
BEGIN
  IF COALESCE(_role_compagnie(p_id, v_moi), 'membre') = 'membre' OR v_role IS NULL OR v_role = 'chef'
     OR (v_role = 'officier' AND _role_compagnie(p_id, v_moi) <> 'chef') THEN
    PERFORM _refus('Retrait impossible', 'role');
  END IF;
  DELETE FROM faction_members WHERE faction_id = p_id AND user_id = p_user;
  UPDATE users SET faction_id = NULL WHERE id = p_user AND faction_id = p_id;
END;
$function$;
```

Puis `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated;` pour `compagnies`, `compagnie`,
`fonder_compagnie`, `modifier_compagnie`, `rejoindre_compagnie`, `repondre_demande`, `quitter_compagnie`,
`changer_role`, `retirer_membre` ; `REVOKE ALL … FROM PUBLIC, anon, authenticated` pour `_refus`,
`_verifier_fiche`. Et `mes_notifications` (live) : ajouter `'compagnie', CASE WHEN n.data ? 'compagnieId' THEN
json_build_object('id', n.data->>'compagnieId', 'nom', n.data->>'compagnieNom') END` dans la ligne d'une
notification et `'compagnie', NULL` dans celle d'une mise à jour ; `_notification_v2` (live) : ajouter les
types `demande_compagnie` et `demande_acceptee` à sa liste.

- [ ] **Étape 3 : test** — `BEGIN; <420> <421> <bloc> ROLLBACK;`
Expected : `BILAN fonder_autre=porteur role_fondateur=chef rejoindre=demande membre_avant=non demandes_vues=0
membre_apres=membre notif=1 chef=chef/officier renommer_officier=role apres_depart=chef retiree=true liste=8`.

- [ ] **Étape 4 : commit**

```bash
git add supabase/migrations/421_compagnies_fonctions.sql
git commit -m "feat(db): les gestes d'une Compagnie — lire, fonder, rejoindre, repondre, quitter, roles (mig 421)"
```

---

### Tâche 3 : migration 422 — les canaux, la revendication, la fiche d'un lieu, le profil

**Files :** Create `supabase/migrations/422_compagnies_canaux.sql` (via `scratchpad/mig422.py`, copies live), `scratchpad/test422_bloc.sql`.

**Interfaces — Produces :**
- `mes_canaux()` → `json` : `[{id, nom, couleur}]` = mes Compagnies (ordre alphabétique) ; `general` et
  `bugs` restent connus du front.
- `registre(p_canaux, p_limite)` : accepte `general`, `bugs` et les ids des Compagnies dont je suis membre
  (les autres canaux demandés sont ignorés) ; chaque message rend en plus `'canalNom'` et `'canalCouleur'`
  (null pour general/bugs).
- `ecrire_au_registre(p_canal, …)` : accepte une Compagnie dont je suis membre ; sinon `Canal inconnu`.
- `registre_non_lus()` : compte aussi les messages de mes Compagnies.
- `revendiquer_lieu(p_id, p_compagnons, p_nom, p_pour_compagnie text DEFAULT NULL)` : écrit `pour_compagnie`
  sur l'expédition et sur `place_veille` (refus `role` si je ne suis pas membre).
- `fiche_lieu` : `revendication.pourCompagnie = {id, nom, couleur} | null`.
- `get_profil_explorateur` : `compagnies: [{id, nom, couleur}]` (publiques, et privées si je suis moi-même
  dans cette Compagnie ou si c'est mon profil).

- [ ] **Étape 1 : le test qui échoue** — `scratchpad/test422_bloc.sql` :

```sql
DO $t$
DECLARE b text := ''; porteur text; autre text; c text; x json; v_hint text;
BEGIN
  SELECT f.user_id INTO porteur FROM user_fragments f JOIN title_fragments tf ON tf.id = f.fragment_id AND tf.visible
  WHERE f.user_id ~ '^[0-9a-f-]{36}$' LIMIT 1;
  SELECT u.id INTO autre FROM users u WHERE u.id ~ '^[0-9a-f-]{36}$' AND u.id <> porteur
    AND NOT EXISTS (SELECT 1 FROM faction_members m WHERE m.user_id = u.id) LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', porteur, 'role', 'authenticated')::text, true);
  c := public.fonder_compagnie('Test Canal', NULL, NULL, '#4f7a4a', NULL, true)->>'id';
  PERFORM public.ecrire_au_registre(c, 'Secret de Compagnie', '{}');
  b := 'canaux=' || json_array_length(public.mes_canaux())
    || ' lus_membre=' || (SELECT count(*) FROM json_array_elements(public.registre(ARRAY['general', c], 200)) m WHERE m->>'canal' = c)
    || ' couleur=' || COALESCE((SELECT m->>'canalCouleur' FROM json_array_elements(public.registre(ARRAY[c], 200)) m LIMIT 1), 'null');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', autre, 'role', 'authenticated')::text, true);
  b := b || ' lus_autre=' || (SELECT count(*) FROM json_array_elements(public.registre(ARRAY['general', c], 200)) m WHERE m->>'canal' = c);
  BEGIN PERFORM public.ecrire_au_registre(c, 'intrus', '{}'); b := b || ' ecrire_autre=PASSE';
  EXCEPTION WHEN others THEN b := b || ' ecrire_autre=refuse'; END;
  RAISE EXCEPTION 'BILAN %', b;
END $t$;
```

Expected sans 422 : ERREUR `function public.mes_canaux() does not exist`.

- [ ] **Étape 2 : `mig422.py`** (copies live, remplacements exacts) :

```python
from live import live, R, S

def r(s, x, y):
    assert x in s, x[:70]
    return s.replace(x, y, 1)

MES = "(SELECT array_agg(m.faction_id) FROM faction_members m JOIN factions f ON f.id = m.faction_id WHERE m.user_id = (auth.uid())::text AND NOT f.retired)"

registre = live('public.registre(text[],integer)')
registre = r(registre, "WHERE c.channel = ANY (p_canaux) AND c.channel IN ('general', 'bugs')",
             "WHERE c.channel = ANY (p_canaux)\n      AND (c.channel IN ('general', 'bugs') OR c.channel = ANY (COALESCE(" + MES + ", '{}')))")
registre = r(registre, "      'canal', m.channel,", "      'canal', m.channel,\n      -- 422 : le nom et la couleur d'un canal de Compagnie.\n      'canalNom', (SELECT f.title FROM factions f WHERE f.id = m.channel),\n      'canalCouleur', (SELECT f.color FROM factions f WHERE f.id = m.channel),")

ecrire = live('public.ecrire_au_registre(text,text,text[])')
ecrire = r(ecrire, "  IF p_canal NOT IN ('general', 'bugs') THEN",
           "  -- 422 : une Compagnie dont je suis membre est un canal aussi.\n  IF p_canal NOT IN ('general', 'bugs') AND public._role_compagnie(p_canal, v_moi) IS NULL THEN")

non_lus = live('public.registre_non_lus()')
non_lus = r(non_lus, "          AND m.channel IN ('general', 'bugs')",
            "          AND (m.channel IN ('general', 'bugs') OR public._role_compagnie(m.channel, moi.id) IS NOT NULL)")

revendiquer = live('public.revendiquer_lieu(text,text[],text)')
revendiquer = r(revendiquer, "revendiquer_lieu(p_id text, p_compagnons text[], p_nom text)",
                "revendiquer_lieu(p_id text, p_compagnons text[], p_nom text, p_pour_compagnie text DEFAULT NULL::text)")
revendiquer = r(revendiquer, "  v_faction text;", "  v_faction text;\n  v_pour text := NULLIF(btrim(p_pour_compagnie), '');")
revendiquer = r(revendiquer, "  -- Déjà tenant, seul", "  -- 422 : « pour » une Compagnie dont je suis membre seulement.\n  IF v_pour IS NOT NULL AND public._role_compagnie(v_pour, v_moi) IS NULL THEN\n    RAISE EXCEPTION 'Pas membre de cette Compagnie' USING ERRCODE = 'P0001', HINT = 'role';\n  END IF;\n\n  -- Déjà tenant, seul")
revendiquer = r(revendiquer, "    UPDATE place_veille SET planted_at = now() WHERE place_id = p_id;",
                "    UPDATE place_veille SET planted_at = now(), pour_compagnie = COALESCE(v_pour, pour_compagnie) WHERE place_id = p_id;\n    UPDATE expeditions SET pour_compagnie = COALESCE(v_pour, pour_compagnie)\n    WHERE id = (SELECT expedition_id FROM place_veille WHERE place_id = p_id);")
revendiquer = r(revendiquer, "  INSERT INTO expeditions (place_id, is_neutral, faction_id, title)\n  VALUES (p_id, v_faction IS NULL, v_faction, v_nom)",
                "  INSERT INTO expeditions (place_id, is_neutral, faction_id, title, pour_compagnie)\n  VALUES (p_id, v_faction IS NULL, v_faction, v_nom, v_pour)")
revendiquer = r(revendiquer, "previous_expedition_id = NULL, veilleur_user_id = v_moi;",
                "previous_expedition_id = NULL, veilleur_user_id = v_moi, pour_compagnie = v_pour;")

fiche = live('public.fiche_lieu(text)')
fiche = r(fiche, "        'depuis', v.planted_at)\n      FROM place_veille v",
          "        'depuis', v.planted_at,\n        -- 422 : « pour Le Lys de Fer ».\n        'pourCompagnie', (SELECT json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color)\n                          FROM factions f WHERE f.id = v.pour_compagnie AND NOT f.retired))\n      FROM place_veille v")

profil = live('public.get_profil_explorateur(text)')
profil = r(profil, "      'estMoi', v_moi", "      -- 422 : ses Compagnies (les privées : pour lui-même, ou pour un autre membre).\n      'compagnies', COALESCE((SELECT json_agg(json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color) ORDER BY f.title)\n        FROM faction_members m JOIN factions f ON f.id = m.faction_id\n        WHERE m.user_id = p_user_id AND NOT f.retired\n          AND (NOT f.privee OR v_moi OR public._role_compagnie(f.id, (auth.uid())::text) IS NOT NULL)), '[]'::json),\n      'estMoi', v_moi")

canaux = """CREATE FUNCTION public.mes_canaux() RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT COALESCE(json_agg(json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color) ORDER BY f.title), '[]'::json)
  FROM faction_members m JOIN factions f ON f.id = m.faction_id
  WHERE m.user_id = (auth.uid())::text AND NOT f.retired;
$function$;
REVOKE ALL ON FUNCTION public.mes_canaux() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_canaux() TO authenticated;
"""
head = """-- WHY: les Compagnies dans La Communauté (spec compagnies) : leurs canaux s'ajoutent au Registre pour leurs
--      membres seulement ; la revendication peut se faire « pour » une Compagnie ; la fiche d'un lieu et le
--      profil le disent.
-- SCHEMA CHECKED (05/10/2026) : migs 420-421 ; définitions live de registre, ecrire_au_registre,
--      registre_non_lus, revendiquer_lieu, fiche_lieu, get_profil_explorateur.
-- DROP vérifié : l'ancienne signature de revendiquer_lieu n'est appelée que par le front V2.

DROP FUNCTION public.revendiquer_lieu(text, text[], text);
"""
grants = """
REVOKE ALL ON FUNCTION public.revendiquer_lieu(text, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revendiquer_lieu(text, text[], text, text) TO authenticated;
"""
out = head + canaux + '\n' + registre + '\n\n' + ecrire + '\n\n' + non_lus + '\n\n' + revendiquer + '\n' + grants + '\n' + fiche + '\n\n' + profil + '\n'
open(R + '/supabase/migrations/422_compagnies_canaux.sql', 'w', encoding='utf-8', newline='\n').write(out)
print('ok')
```

(Avant le DROP : `SELECT proname FROM pg_proc WHERE prosrc LIKE '%revendiquer_lieu(%'` doit être vide. Si un
`assert` échoue, la définition live diffère du texte attendu : relire la définition live et ajuster le motif.
`fiche_lieu` doit garder les champs de compatibilité de la mig 417.)

- [ ] **Étape 3 : test** — `BEGIN; <420> <421> <422> <bloc> ROLLBACK;`
Expected : `BILAN canaux=1 lus_membre=2 couleur=#4f7a4a lus_autre=0 ecrire_autre=refuse` (2 : « La Compagnie
est fondée. » et le message).

- [ ] **Étape 4 : Uriel applique 420, 421, 422** — `pnpm dlx supabase db push --linked` ; je vérifie en prod (le
bilan de la Tâche 1 sans BEGIN/ROLLBACK, en lecture) ; `pnpm --filter web-v2 gen:types`.

- [ ] **Étape 5 : commit**

```bash
git add supabase/migrations/422_compagnies_canaux.sql apps/web-v2/src/shared/supabase/database.types.ts
git commit -m "feat(db): les Compagnies dans La Communaute, la revendication pour une Compagnie (mig 422)"
```

---

### Tâche 4 : La Communauté — des canaux dynamiques

**Files :**
- Modify : `features/messages/api/lireRegistre.ts` (+ test), `features/messages/api/registre.ts`,
  `features/messages/lib/filtres.ts` (+ test), `features/messages/components/Registre.tsx` (+ test),
  `ChoixCanal.tsx`, `LigneMessage.tsx`, `Registre.module.css`, `LigneMessage.module.css`,
  `ChoixCanal.module.css`, `BarreEcrire.tsx` (le texte d'aide).
- Create : `features/messages/hooks/useCanaux.ts`, `shared/supabase/canaux.ts` (lu aussi par la zone Lieu,
  Tâche 8), `features/messages/lib/aide.ts` (+ test).

**Interfaces :**
- Consumes : `mes_canaux()`, `registre` (canalNom, canalCouleur), `ecrire_au_registre`.
- Produces : `type Canal = string` ; `shared/supabase/canaux.ts` exporte `type CanalCompagnie = { id:
  string; nom: string; couleur: string }`, `lireCanaux(json): CanalCompagnie[]` et `fetchCanaux():
  Promise<CanalCompagnie[]>` (appelle `mes_canaux`) ; `Message` gagne `canalNom: string | null`,
  `canalCouleur: string | null` ; `aideDuChamp(nom: string): string` ; `useCanaux()` → `{ compagnies: CanalCompagnie[] }` ; `lireFiltres(stockage,
  connus: readonly string[])` ; `FILTRES_FIXES = ['general', 'bugs', 'activite']`.

- [ ] **Étape 1 : tests qui échouent**

`lireRegistre.test.ts` : un message de canal `f-abc` avec `canalNom: 'Le Lys de Fer'`, `canalCouleur:
'#5f6f86'` se lit (aujourd'hui : « canal inconnu ») :

```ts
test('un message de Compagnie se lit, avec le nom et la couleur de son canal', () => {
  const [m] = lireRegistre([{ ...MESSAGE, canal: 'f-abc', canalNom: 'Le Lys de Fer', canalCouleur: '#5f6f86' }])
  expect(m).toMatchObject({ canal: 'f-abc', canalNom: 'Le Lys de Fer', canalCouleur: '#5f6f86' })
})
```

`filtres.test.ts` :

```ts
test('une Compagnie quittée sort du choix gardé', () => {
  const stockage = { getItem: () => JSON.stringify(['general', 'f-parti']) }
  expect([...lireFiltres(stockage, ['general', 'bugs', 'activite', 'f-lys'])]).toEqual(['general'])
})
test('une Compagnie nouvelle est cochée par défaut', () => {
  const stockage = { getItem: () => JSON.stringify({ coches: ['general'], connus: ['general', 'bugs', 'activite'] }) }
  expect(lireFiltres(stockage, ['general', 'bugs', 'activite', 'f-lys']).has('f-lys')).toBe(true)
})
```

(Le choix gardé devient `{ coches, connus }` : un canal absent de `connus` est nouveau, donc coché ; l'ancien
format, un tableau, reste lu.)

`Registre.test.tsx` (avec les mocks déjà présents, plus `fetchCanaux` → `[{ id: 'f-lys', nom: 'Le Lys de
Fer', couleur: '#5f6f86' }]`) :

```tsx
test('mes Compagnies sont des gélules, et le champ écrit dans celle qu’on choisit', async () => {
  monter()
  expect(await screen.findByRole('button', { name: /Le Lys de Fer/ })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: /Général/ })) // le choix du canal
  await userEvent.click(screen.getByRole('menuitem', { name: 'Le Lys de Fer' }))
  expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Écrire au Lys de Fer…')
})

test('la gélule d’une Compagnie porte sa couleur', async () => {
  monter()
  const g = await screen.findByRole('button', { name: /Le Lys de Fer/ })
  expect(g.style.getPropertyValue('--couleur')).toBe('#5f6f86')
})
```

(Adapter les rôles/noms au balisage réel de `ChoixCanal` et `BarreEcrire` — lire les deux fichiers avant
d'écrire le test, et garder l'intention : choisir la Compagnie change la cible et le texte d'aide.)

Run : `pnpm --filter web-v2 exec vitest run src/features/messages` → FAIL.

- [ ] **Étape 2 : code**

`lireRegistre.ts` :

```ts
export type Canal = string // 'general', 'bugs', ou l'id d'une Compagnie (mig 422)
```

`Message` gagne `canalNom: string | null; canalCouleur: string | null` ; `canal: chaine(m.canal)`,
`canalNom: ouNull(chaine)(m.canalNom ?? null)`, `canalCouleur: ouNull(chaine)(m.canalCouleur ?? null)`
(absents avant la 422 : `null`). `CANAUX` devient `CANAUX_FIXES: readonly Canal[] = ['general', 'bugs']`.

`shared/supabase/canaux.ts` :

```ts
/**
 * QUOI     — mes Compagnies vues comme canaux (mig 422) : l'id, le nom, la couleur.
 * POURQUOI — La Communauté en fait des gélules, la fenêtre « Revendiquer » une liste « Pour une
 *            Compagnie » : deux zones, une seule lecture, ici.
 */
import { chaine, liste, objet } from '@/shared/lib/lire'
import { supabase } from './client'

export type CanalCompagnie = { id: string; nom: string; couleur: string }

export const lireCanaux = liste((v): CanalCompagnie => {
  const o = objet(v)
  return { id: chaine(o.id), nom: chaine(o.nom), couleur: chaine(o.couleur) }
})

export async function fetchCanaux() {
  const { data, error } = await supabase.rpc('mes_canaux')
  if (error) throw error
  return lireCanaux(data)
}
```

`registre.ts` : `fetchRegistre(canaux: readonly Canal[])` passe `p_canaux: [...canaux]`.

`useCanaux.ts` :

```ts
/**
 * QUOI     — mes Compagnies, qui sont autant de canaux de La Communauté (mig 422).
 * POURQUOI — rejoindre ou quitter une Compagnie change les gélules : la clé `['canaux']` se relit
 *            après chacun de ces gestes (zone Compagnies, par la clé partagée `canauxKey`).
 */
import { useQuery } from '@tanstack/react-query'
import { canauxKey } from '@/shared/lib/cles'
import { fetchCanaux } from '@/shared/supabase/canaux'

export function useCanaux() {
  const q = useQuery({ queryKey: canauxKey, queryFn: fetchCanaux })
  return { compagnies: q.data ?? [] }
}
```

`shared/lib/cles.ts` gagne `export const canauxKey = ['canaux'] as const` (la zone Compagnies l'invalide).

`filtres.ts` : `Filtre = string` ; `FILTRES_FIXES = ['general', 'bugs', 'activite'] as const` ;
`lireFiltres(stockage, connus)` lit `{ coches, connus }` (ou l'ancien tableau = `coches`, `connus` = les
fixes), garde les coches encore connues, ajoute les canaux connus absents de l'ancien `connus`, et rend tout
coché si le résultat est vide ; `garderFiltres(stockage, coches, connus)` écrit `{ coches, connus }`.

`Registre.tsx` :
- `const { compagnies } = useCanaux()` ; `connus = [...FILTRES_FIXES, ...compagnies.map((c) => c.id)]` ;
  la requête du Registre demande `['general', 'bugs', ...compagnies.map((c) => c.id)]` (clé
  `['registre', ids]`).
- Les gélules : les fixes comme aujourd'hui, puis une par Compagnie :

```tsx
{compagnies.map((c) => (
  <button
    key={c.id}
    type="button"
    className={styles.filtreCompagnie}
    style={{ '--couleur': c.couleur }}
    aria-pressed={coches.has(c.id)}
    onClick={() => { basculer(c.id) }}
  >
    <img src={coche} alt="" className={styles.coche} />
    {c.nom}
  </button>
))}
<Link className={styles.plusCompagnies} to="compagnies" relative="path">＋ Compagnies</Link>
```

- `NOMS_COURTS` devient une fonction `nomDuCanal(canal)` : « Général », « Bugs & suggestions », ou le nom de
  la Compagnie ; `ChoixCanal` reçoit `canaux={['general', 'bugs', ...ids]}`, `nom={nomDuCanal}` et
  `couleur={(c) => compagnies.find((x) => x.id === c)?.couleur ?? null}`.
- Le texte d'aide du champ pour une Compagnie : `aideDuChamp(nom)` dans `lib/aide.ts`, qui contracte
  l'article comme on le dit à voix haute :

```ts
// « Le Lys de Fer » → « Écrire au Lys de Fer… » ; « Les Cavaliers » → « Écrire aux Cavaliers… » ;
// « Verte Guilde » → « Écrire à Verte Guilde… ».
export function aideDuChamp(nom: string): string {
  if (nom.startsWith('Le ')) return `Écrire au ${nom.slice(3)}…`
  if (nom.startsWith('Les ')) return `Écrire aux ${nom.slice(4)}…`
  return `Écrire à ${nom}…`
}
```

  et son test (ces trois cas, plus « L’ordre des Deux Mondes » → « Écrire à L’ordre des Deux Mondes… »).
- Répondre à un message choisit son canal : là où `BarreEcrire` reçoit la réponse (mention `@Nom` ajoutée),
  `setCanal(message.canal)` si ce canal est connu.
- Un canal choisi qui n'est plus connu (Compagnie quittée) revient à `'general'` (`useEffect` sur `connus`).
- `LigneMessage` : le préfixe « [Le Lys de Fer] » pour un message de Compagnie (même règle que Bugs), et
  `style={{ '--couleur': m.canalCouleur }}` + `data-canal="compagnie"` quand `canalCouleur` existe.

CSS (jetons seulement, la couleur vient de `--couleur`) :

```css
/* Une gélule de Compagnie : sa couleur en voile, son nom à son encre (plafonnée en clarté). */
.filtreCompagnie {
  background: color-mix(in srgb, var(--couleur) 18%, var(--color-fond));
  color: oklch(from var(--couleur) min(l, 0.45) c h);
}
```

(mêmes propriétés que `.filtre` pour la forme ; `.filtreCompagnie[aria-pressed='false']` comme les autres) ;
dans `LigneMessage.module.css` : `.message[data-canal='compagnie'] .texte, .suite[data-canal='compagnie']
.texte { color: oklch(from var(--couleur) min(l, 0.45) c h); }` ; `.plusCompagnies` : bordure pointillée
`var(--color-accent)`, texte accent, même taille que les gélules.

- [ ] **Étape 3 : verts, lint, commit**

Run : `pnpm --filter web-v2 exec vitest run src/features/messages && pnpm --filter web-v2 lint && pnpm --filter web-v2 typecheck` → PASS.

```bash
git add apps/web-v2/src
git commit -m "feat(v2): les Compagnies sont des canaux de La Communaute"
```

---

### Tâche 5 : la zone Compagnies — lire, la page « Les Compagnies », l'écran des non-Porteurs

**Files :** Create `features/compagnies/README.md`, `api/compagnies.ts`, `api/lireCompagnies.ts` (+ test),
`hooks/useCompagnies.ts`, `components/PageCompagnies.tsx` (+ `.module.css`, + test),
`components/ReserveAuxPorteurs.tsx` (+ `.module.css`), `components/AvatarCompagnie.tsx` (+ css) ; Modify
`app/router.tsx`, `app/routes/` (nouveau `compagnies.tsx`).

**Interfaces — Produces :**

```ts
export type Role = 'chef' | 'officier' | 'membre'
export type CarteCompagnie = { id: string; nom: string; devise: string | null; couleur: string; avatar: string | null; privee: boolean; membres: number; role: Role | null; demandee: boolean }
export type ListeCompagnies = { porteur: boolean; miennes: CarteCompagnie[]; autres: CarteCompagnie[] }
export type Membre = { id: string; nom: string; avatar: string | null; role: Role; genre: 'm' | 'f' }
export type FicheCompagnie = { id: string; nom: string; devise: string | null; mission: string | null; couleur: string; avatar: string | null; privee: boolean; fondeeLe: string; roles: { chefM: string; chefF: string; officierM: string; officierF: string }; monRole: Role | null; demandee: boolean; membres: Membre[]; lieux: { id: string; nom: string; par: string | null; quand: string }[]; demandes: { id: string; nom: string; avatar: string | null; mot: string | null; quand: string }[] }
// api/compagnies.ts
fetchCompagnies(): Promise<ListeCompagnies>
fetchCompagnie(id: string): Promise<FicheCompagnie | null>
rejoindre(id: string, mot?: string): Promise<'membre' | 'demande'>
// hooks
useCompagnies() → { liste: ListeCompagnies | undefined, rejoindre: (id: string) => void, enCours: boolean }
```

Routes : `{ path: 'compagnies', Component: RouteCompagnies }`, `{ path: 'compagnies/fonder', Component:
RouteFonder }` (Tâche 7), `{ path: 'compagnie/:id', Component: RouteCompagnie }` (Tâche 6), `{ path:
'compagnie/:id/gerer', Component: RouteGerer }` (Tâche 7).

- [ ] **Étape 1 : tests qui échouent**

`lireCompagnies.test.ts` : une liste et une fiche complètes se lisent ; un rôle inconnu est refusé ; `null`
→ `null`.

```ts
test('la liste se lit', () => {
  const l = lireListe({ porteur: true, miennes: [CARTE], autres: [] })
  expect(l.miennes[0]).toMatchObject({ nom: 'Le Lys de Fer', role: 'chef', membres: 35 })
})
test('un rôle inconnu est refusé', () => {
  expect(() => lireListe({ porteur: true, miennes: [{ ...CARTE, role: 'roi' }], autres: [] })).toThrow()
})
```

(`CARTE` = `{ id: 'f-lys', nom: 'Le Lys de Fer', devise: 'Les forteresses de l’Est.', couleur: '#5f6f86',
avatar: null, privee: false, membres: 35, role: 'chef', demandee: false }`.)

`PageCompagnies.test.tsx` (mock `../api/compagnies`) :

```tsx
test('mes Compagnies, puis Découvrir ; une privée se demande', async () => {
  monter({ porteur: true, miennes: [CARTE], autres: [{ ...CARTE, id: 'f-h', nom: 'Helvetia', privee: true, role: null }] })
  expect(await screen.findByRole('heading', { name: 'Mes Compagnies' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Demander à rejoindre Helvetia' })).toBeInTheDocument()
})
test('un non-Porteur qui veut fonder lit pourquoi, et va à la boutique', async () => {
  monter({ porteur: false, miennes: [], autres: [] })
  await userEvent.click(await screen.findByRole('link', { name: /Fonder une Compagnie/ }))
  expect(await screen.findByText('C’est réservé aux Porteurs')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Découvrir la boutique/ })).toHaveAttribute('href', 'https://runesdechene.com')
})
test('la recherche filtre par nom, devise ou mission', async () => {
  monter({ porteur: true, miennes: [], autres: [{ ...CARTE, role: null }, { ...CARTE, id: 'f-v', nom: 'Verte Guilde', devise: 'Les cascades', role: null }] })
  await userEvent.type(await screen.findByRole('searchbox'), 'cascade')
  expect(screen.queryByText('Le Lys de Fer')).not.toBeInTheDocument()
  expect(screen.getByText('Verte Guilde')).toBeInTheDocument()
})
```

(`monter(liste)` : `fetchCompagnies` résout `liste`, rendu dans un `MemoryRouter` aux routes
`compagnies` / `compagnies/fonder`. Pour un non-Porteur, `compagnies/fonder` affiche `ReserveAuxPorteurs`.)

- [ ] **Étape 2 : code** — fidèle aux maquettes 6 et 8 (relever les valeurs avec `get_design_context` sur
396:236 et 396:404, icônes dans `assets/ui/`) :
- `lireCompagnies.ts` : `lireListe`, `lireFiche` avec `lire.ts` (`chaine`, `ouNull`, `liste`, `booleen`,
  `nombre`, `objet`) et `role(v)` qui refuse l'inconnu.
- `AvatarCompagnie` : l'image (`aLaTaille(avatar, 2 × taille)`) ou, sans image, l'initiale du nom en IM Fell
  sur la couleur (`style={{ '--couleur': couleur }}`).
- `PageCompagnies` : en-tête « Les Compagnies » + phrase ; `<input type="search" aria-label="Chercher une
  Compagnie" placeholder="Une Compagnie, une région…">` (filtre local sans accents :
  `normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()`, dans `lib/chercher.ts` + test) ; « Mes
  Compagnies » (lien vers la fiche) ; « Découvrir » (devise en italique, membres, « Privée », bouton
  « Rejoindre » ou « Demander », `aria-label` « Rejoindre {nom} » / « Demander à rejoindre {nom} » ; une
  demande envoyée : « Demande envoyée », désactivé) ; lien « ＋ Fonder une Compagnie » vers `fonder` ; la note
  « Fonder est réservé aux Porteurs. Rejoindre est ouvert à tous. »
- `rejoindre` : `useMutation` → invalide `['compagnies']` et `canauxKey`.
- `ReserveAuxPorteurs` : le sceau (`assets/ui/sceau-murmure.webp` ou l'image de la maquette), « Fonder une
  Compagnie », « C’est réservé aux Porteurs », le paragraphe de la maquette 8, « Rejoindre une Compagnie, lui,
  est ouvert à tous. », `<a href="https://runesdechene.com" target="_blank" rel="noopener">Découvrir la
  boutique ›</a>`, un lien « Rejoindre une Compagnie » vers `..`, et « Déjà client ? Ton Fragment rejoint le
  compte de l’e-mail de ta commande. »
- `app/routes/compagnies.tsx` : `RouteCompagnies` (`DetailPane title="Les Compagnies"` +
  `PageCompagnies`) ; `RouteFonder` lit `useCompagnies()` : non-Porteur → `ReserveAuxPorteurs`, sinon
  `FonderCompagnie` (Tâche 7 ; d'ici là, la page Porteur affiche `ReserveAuxPorteurs` jamais — le test
  couvre le non-Porteur seulement).

- [ ] **Étape 3 : verts, lint, commit** — `vitest run src/features/compagnies`, `lint`, `typecheck`.

```bash
git add apps/web-v2/src
git commit -m "feat(v2): la page des Compagnies, et l'ecran reserve aux Porteurs"
```

---

### Tâche 6 : la fiche d'une Compagnie

**Files :** Create `features/compagnies/components/FicheCompagnie.tsx` (+ css, + test), `lib/roles.ts` (+
test), `hooks/useCompagnie.ts` ; Modify `api/compagnies.ts` (`quitter`), `app/routes/compagnies.tsx`
(`RouteCompagnie`).

**Interfaces — Produces :** `nomDuRole(fiche: FicheCompagnie, role: Role, genre: 'm' | 'f'): string`
(« Membre » pour un membre) ; `useCompagnie(id)` → `{ fiche, rejoindre, quitter, enCours }`.

- [ ] **Étape 1 : tests qui échouent**

`roles.test.ts` :

```ts
const roles = { chefM: 'Grand Maître', chefF: 'Grande Maîtresse', officierM: 'Éclaireur', officierF: 'Éclaireuse' }
test('le rôle s’accorde', () => {
  expect(nomDuRole(roles, 'chef', 'f')).toBe('Grande Maîtresse')
  expect(nomDuRole(roles, 'officier', 'm')).toBe('Éclaireur')
  expect(nomDuRole(roles, 'membre', 'f')).toBe('Membre')
})
```

(Signature retenue : `nomDuRole(roles: FicheCompagnie['roles'], role, genre)`.)

`FicheCompagnie.test.tsx` : les quatre états du bouton (`monRole` null + publique → « Rejoindre la
Compagnie » ; null + privée → « Demander à rejoindre » ; `demandee` → « Demande envoyée » désactivé ;
membre → « Ouvrir le canal », lien vers `../../messages`) ; « Le Grand Maître et les Éclaireurs » en titre de
section (le pluriel de `officierM` : `${officierM}s` sauf s'il finit par `s` ou `x`) ; « Gérer la Compagnie »
visible pour `chef`/`officier` seulement ; « Quitter la Compagnie » pour un membre ; « Leurs lieux » liste
les lieux (lien vers `../../lieu/<id>`) ; `null` → « Cette Compagnie n’existe plus ».

- [ ] **Étape 2 : code** — fidèle à la maquette 389:309 : bandeau `--couleur`, `AvatarCompagnie` (88 px,
bord crème), nom (Bebas, `--titre-section-size`), devise (IM Fell italique à l'encre plafonnée), ligne
« Compagnie publique · fondée le 12 juin 2026 · 35 membres », mission, bouton, membres (Chef et Officiers
en lignes avec rôle accordé ; les autres en portraits empilés + « et N autres »), « Leurs lieux », « Gérer la
Compagnie › », « Quitter la Compagnie » (une `Feuille` de confirmation : « Quitter Le Lys de Fer ? »).
« Ouvrir le canal » : coche la gélule (`garderFiltres` n'est pas exporté de la zone messages : on passe
`?canal=<id>` à `/messages`, et `Registre` coche ce canal et le choisit à l'ouverture — ajouter ce test à
`Registre.test.tsx` : avec `?canal=f-lys`, la gélule est cochée et le champ dit « Écrire au Lys de Fer… »).

- [ ] **Étape 3 : verts, lint, commit**

```bash
git commit -m "feat(v2): la fiche d'une Compagnie"
```

---

### Tâche 7 : fonder et gérer

**Files :** Create `features/compagnies/components/FonderCompagnie.tsx`, `GererCompagnie.tsx`,
`ChampsCompagnie.tsx` (les champs communs), `PaletteCouleurs.tsx` (+ css, + tests) ; Modify
`api/compagnies.ts` (`fonder`, `modifier`, `repondre`, `changerRole`, `retirer`, `envoyerAvatar`),
`app/routes/compagnies.tsx`.

**Interfaces — Produces :** `ChampsFiche = { nom: string; devise: string; mission: string; couleur: string;
avatar: string | null; privee: boolean }` ; `fonder(f: ChampsFiche): Promise<string>` (l'id) ;
`modifier(id, f: Partial<ChampsFiche> & Partial<FicheCompagnie['roles']>)` ; `envoyerAvatar(fichier:
File): Promise<string>` (l'URL, par `shared/supabase/photos` `envoyerPhotos` après `preparerPhoto`).

- [ ] **Étape 1 : tests qui échouent** — `FonderCompagnie.test.tsx` : remplir nom, devise (compteur
« 0 / 80 »), mission, couleur (palette : 8 boutons `aria-label` « Couleur 1 » … « Couleur 8 », plus un
`<input type="color" aria-label="Une autre couleur">`), Publique/Privée (`Segments`) → « Fonder la
Compagnie » appelle `fonder` avec ces valeurs puis navigue vers `../../compagnie/<id>` ; nom vide → bouton
désactivé ; refus `nom_pris` → « Ce nom est déjà pris » sous le champ. `GererCompagnie.test.tsx` : un
officier ne voit pas « Les rôles » ni « Passer la main » ; le Chef renomme les rôles (4 champs) ; « Accepter »
appelle `repondre(id, user, true)` ; « Nommer {officierM} / {officierF} » (« Nommer Éclaireur / Éclaireuse ») appelle `changerRole(id, user, 'officier')` ; « Passer la
main à un autre Chef… » ouvre une `Feuille` qui liste les membres, et confirmer appelle `changerRole(id,
user, 'chef')`.

- [ ] **Étape 2 : code** — fidèle aux maquettes 390:258 (Gérer) et 396:326 (Fonder) ; palette :
`['#5f6f86', '#4f7a4a', '#7a5c9b', '#a0522d', '#b03a3a', '#9e8038', '#3f6b72', '#eaeae6']` ; l'avatar :
`<input type="file" accept="image/*">` → `preparerPhoto` → `envoyerAvatar` ; après chaque geste, invalider
`['compagnie', id]`, `['compagnies']` et `canauxKey`.

- [ ] **Étape 3 : verts, lint, commit**

```bash
git commit -m "feat(v2): fonder et gerer une Compagnie"
```

---

### Tâche 8 : revendiquer pour une Compagnie, la fiche d'un lieu, le profil, les notifications

**Files :** Modify `features/lieu/components/FenetreRevendication.tsx` (+ test), `features/lieu/api/lieu.ts`
(`revendiquerLieu(id, compagnons, nom, pourCompagnie)`), `features/lieu/api/lireLieu.ts` (`revendication.
pourCompagnie`), `features/lieu/components/FicheLieu.tsx` (« · pour … ») ;
`features/compte/api/lireProfil.ts` + le composant du profil (gélules) ;
`features/notifications/api/lireNotifications.ts` (`compagnie`), `lib/phrase.ts`, `components/Notifications.tsx`
(`cibleDe`).

- [ ] **Étape 1 : tests qui échouent**
- `FenetreRevendication.test.tsx` : la fenêtre lit mes Compagnies par `useQuery({ queryKey: canauxKey,
  queryFn: fetchCanaux })` (`shared/supabase/canaux.ts`, Tâche 4) ; « Pour une Compagnie (facultatif) » montre « Aucune », « Le Lys de Fer » ; choisir « Le Lys de
  Fer » puis « Revendiquer » appelle `revendiquerLieu('a', [], 'Les Loups', 'f-lys')`. Sans Compagnie : la
  section n'apparaît pas.
- `FicheLieu.test.tsx` : `revendication.pourCompagnie = { id: 'f-lys', nom: 'Le Lys de Fer', couleur:
  '#5f6f86' }` → la ligne dit « · pour Le Lys de Fer » (lien vers `../compagnie/f-lys`).
- `lireProfil.test.ts` + le composant : `compagnies` se lit (absent → `[]`) ; le profil montre une gélule par
  Compagnie (lien vers la fiche).
- `phrase.test.ts` : `demande_compagnie` → « Margaux demande à rejoindre Le Lys de Fer » ; `demande_acceptee`
  → « Ta demande pour Le Lys de Fer est acceptée ». `cibleDe` : `demande_compagnie` → `../compagnie/<id>/gerer`, `demande_acceptee` →
  `../compagnie/<id>`.

- [ ] **Étape 2 : code** — selon les maquettes 390:327 (gélules « Aucune / Le Lys de Fer / Verte Guilde » sous
« Nom de l'expédition », la phrase d'aide) et la spec ; `Notification` gagne `compagnie: { id: string; nom:
string } | null` (absent → `null`).

- [ ] **Étape 3 : verts, lint, commit**

```bash
git commit -m "feat(v2): revendiquer pour une Compagnie ; la fiche, le profil et la cloche le disent"
```

---

### Tâche 9 : vérifier, livrer, noter

- [ ] Suite complète, lint, build : `pnpm --filter web-v2 test && pnpm --filter web-v2 lint && pnpm --filter web-v2 build`.
- [ ] Navigateur (V2 en dev, onglet visible, 390 px puis PC), avec deux comptes si possible :
  1. La Communauté : les gélules de mes Compagnies, leurs messages à leur encre, écrire dans une Compagnie,
     répondre (le canal suit), « ＋ Compagnies ».
  2. La page « Les Compagnies » : rechercher, rejoindre une publique (la gélule apparaît), demander une
     privée ; second compte : « Demande envoyée » ; premier compte : la cloche, « Gérer », « Accepter ».
  3. Fonder (compte Porteur) ; « C'est réservé aux Porteurs » (compte non-Porteur) et le lien boutique.
  4. Gérer : couleur, devise, rôles accordés (vérifier un compte « féminin »), passer la main, quitter.
  5. Revendiquer « pour » une Compagnie (si un lieu est à portée ; sinon test transactionnel SQL déjà fait) ;
     la fiche du lieu dit « · pour … » ; « Leurs lieux ».
  6. Une Compagnie V1 en blanc (s'il y en a une) : texte lisible.
  7. Comparer chaque écran à sa maquette Figma (1 à 8) ; console sans erreur.
  8. La V1 : le tchat de Compagnie V1 montre les messages écrits en V2 (même canal).
- [ ] Version Pythéas suivante, commit, déploiement V2 (puis V1 depuis `apps/explore-web` si elle a changé).
- [ ] `_État.md` : les Compagnies livrées (Où on en est) ; `docs/v2/purge-back.md` : `factions.bonus_*`,
  `faction_gold_log`, `faction_banner_history`, `faction_tag_bonuses`, `faction_grade_labels`,
  `faction_members.crowns_*`, `users.faction_change_*` (V1 seulement, à supprimer à la bascule) ; `git push`.
