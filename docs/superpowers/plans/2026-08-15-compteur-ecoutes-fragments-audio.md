# Compteur d'écoutes des Fragments audio — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mesurer les écoutes et le taux de complétion des voix off des Fragments, sur la page motif et sur la fiche produit, et les restituer dans le Hub — pour décider si la voix off reste au budget de chaque drop.

**Architecture :** Une table `fragment_audio_plays` verrouillée (aucune policy, aucun accès direct), écrite par une RPC `security definer` exposée à `anon` et appelée depuis le thème Shopify, lue par une seconde RPC réservée au staff via le `_is_staff()` existant. Côté thème, le lecteur `<audio>` natif et son tracking sont extraits dans un snippet partagé appelé par les deux surfaces. Côté Hub, un écran de lecture seule.

**Tech Stack :** Postgres/Supabase (migrations `NNN` + `db push --linked`), Liquid + JS vanilla (thème Shopify), React 18 + TypeScript strict + Vite (Hub), Shopify Admin GraphQL via le proxy Netlify existant.

**Spec :** `docs/superpowers/specs/2026-08-14-compteur-ecoutes-fragments-audio-design.md`

## Global Constraints

- **pnpm uniquement** — jamais npm ni yarn. `npx` seulement pour `supabase`.
- **TypeScript strict** — aucun `any`, aucun `@ts-ignore`, aucun `as unknown as X`.
- **Aucun `console.log`** laissé dans le code livré (`console.warn`/`error` tolérés avec discernement).
- **Migrations** : fichiers `NNN_description.sql` séquentiels dans `supabase/migrations/`, en-tête `-- WHY :` de 3 à 5 lignes obligatoire. **Canal unique `npx supabase db push --linked`** — interdits : MCP `apply_migration`, dashboard SQL, `db query -f`.
- **Avant tout apply** : `node scripts/migration-preview.mjs <fichier>` puis `npx supabase db push --dry-run --linked`.
- **Après toute modif SQL** : `python3 scripts/graphify-sql.py`.
- **On travaille directement sur la DB de production.** Tester sur données réelles, prévoir le rollback.
- **Vérification SQL** : via le MCP `mcp__plugin_supabase_supabase__execute_sql` (autorisé dans `.claude/settings.local.json`).
- **Build obligatoire avant push** : `pnpm build`.
- **Déploiement Netlify manuel**, jamais d'auto-deploy Git.
- **Commit fréquent** à chaque étape qui marche ; **push par lots cohérents**, et toujours en fin de session.
- **Deux repos** : le monorepo app (`C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/`) et le thème Shopify voisin (`C:/Users/uriel/Desktop/DEVS/shopify (Runes de Chêne)/`). Commits séparés, jamais de fusion.
- **Clé de comptage** : `ill.system.handle` du métaobjet Illustration. Jamais le tag produit `fragment:*`.
- **Valeurs `source` autorisées** : exactement `'motif'` et `'produit'`.
- **Seuil d'écoute** : `min(10 secondes, 25 % de la durée)`.
- **URL Supabase** : `https://ukpapqssgsxirsgmcvof.supabase.co`.

---

## Structure des fichiers

**Monorepo app :**

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/340_fragment_audio_plays.sql` (créer) | Table verrouillée + index + RPC d'écriture anon |
| `supabase/migrations/341_get_fragment_audio_stats.sql` (créer) | RPC d'agrégat réservée au staff |
| `apps/hub/src/components/FragmentsAudio.tsx` (créer) | Écran Hub : tableau des écoutes + bandeau de couverture |
| `apps/hub/src/lib/shopifyIllustrations.ts` (créer) | Interrogation Admin GraphQL des métaobjets Illustration et des produits |
| `apps/hub/src/App.tsx` (modifier, ~ligne 122) | Route `/shopify/fragments-audio` |
| `apps/hub/src/components/Sidebar.tsx` (modifier, ~ligne 74) | Entrée de menu sous la section Shopify |

**Repo thème Shopify :**

| Fichier | Responsabilité |
|---|---|
| `snippets/fragment-audio.liquid` (créer) | Lecteur `<audio>` + styles + tracking, pour les deux surfaces |
| `sections/rdc_motif.liquid` (modifier) | Le bloc audio devient un appel au snippet ; les règles CSS `.rdcm__audio*` devenues mortes sont supprimées |
| `sections/lecture-fragment-v2.liquid` (modifier) | Résolution de l'Illustration depuis le produit + appel au snippet |

Le placement de `FragmentsAudio.tsx` à plat dans `apps/hub/src/components/` est délibéré : il suit `ShopifyUnlocks.tsx` et `ShopifySync.tsx`, qui y sont déjà. Ne pas créer de sous-dossier pour un fichier.

**Note sur les tests :** le Hub n'a pas de lanceur de tests (`apps/hub/package.json` n'expose que `dev`/`build`/`preview` ; seul `explore-web` a vitest). On n'installe pas un harnais de test dans le Hub pour cette feature — ce serait une décision d'architecture hors périmètre. Le cycle de vérification est donc : **assertions SQL réelles sur la base de production** (tâches 1-2), puis **relevés manuels dans le navigateur** avec sortie attendue explicite (tâches 3-6). Chaque étape de vérification indique ce qu'il faut voir ; ne rien cocher sans l'avoir vu.

---

## Task 1 : Table verrouillée et RPC d'écriture

**Files:**
- Create: `supabase/migrations/340_fragment_audio_plays.sql`

**Interfaces:**
- Consumes: rien — première tâche, aucune dépendance.
- Produces: table `public.fragment_audio_plays` (colonnes `id`, `illustration_handle`, `source`, `session_id`, `listened_seconds`, `completed`, `played_on`, `created_at`) et la fonction `public.log_fragment_audio_play(p_illustration_handle text, p_source text, p_session_id text, p_listened_seconds integer, p_completed boolean) returns void`, exécutable par `anon`. Les tâches 3 et 4 appellent cette fonction en POST sur `/rest/v1/rpc/log_fragment_audio_play`.

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/340_fragment_audio_plays.sql` :

```sql
-- 340 — Compteur d'écoutes des Fragments audio
--
-- WHY : le lecteur de voix off tourne depuis plusieurs drops sans aucune mesure.
-- Impossible de dire si les Fragments sont écoutés, et encore moins jusqu'au bout,
-- alors que chaque voix off a un coût de production à chaque drop. Cette table
-- produit la donnée qui tranche : continue-t-on à payer la narration ?
-- Clé = handle du métaobjet Illustration, PAS le tag produit `fragment:*` — les
-- migrations 251/252/253 ont déjà payé le prix des variations de casse des tags.

CREATE TABLE public.fragment_audio_plays (
  id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  illustration_handle text        NOT NULL,
  source              text        NOT NULL CHECK (source IN ('motif', 'produit')),
  session_id          text        NOT NULL,
  listened_seconds    integer     NOT NULL DEFAULT 0,
  completed           boolean     NOT NULL DEFAULT false,
  played_on           date        NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fragment_audio_plays IS
  'Une ligne par (session, Illustration, surface, jour). Écrite uniquement par
   log_fragment_audio_play(), lue uniquement par get_fragment_audio_stats().';

-- Le dédoublonnage vit ICI, pas dans le navigateur : le sessionStorage côté client
-- se contourne en trois secondes de console.
CREATE UNIQUE INDEX fragment_audio_plays_unique_daily
  ON public.fragment_audio_plays (session_id, illustration_handle, source, played_on);

CREATE INDEX fragment_audio_plays_handle_idx
  ON public.fragment_audio_plays (illustration_handle, source);

-- Verrouillage : aucune policy, donc aucun accès direct pour anon ni authenticated.
-- Tout passe par les deux fonctions SECURITY DEFINER. Une policy d'insert anon
-- serait une surface d'écriture ouverte sans contrepartie.
ALTER TABLE public.fragment_audio_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragment_audio_plays FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.fragment_audio_plays FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_fragment_audio_play(
  p_illustration_handle text,
  p_source              text,
  p_session_id          text,
  p_listened_seconds    integer,
  p_completed           boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Entrées hostiles ou malformées : on sort en silence. Le visiteur n'a rien
  -- demandé, il n'a pas à recevoir une erreur PostgREST dans sa console.
  IF coalesce(btrim(p_illustration_handle), '') = '' THEN RETURN; END IF;
  IF p_source NOT IN ('motif', 'produit') THEN RETURN; END IF;
  IF length(coalesce(p_session_id, '')) NOT BETWEEN 8 AND 64 THEN RETURN; END IF;

  INSERT INTO public.fragment_audio_plays
    (illustration_handle, source, session_id, listened_seconds, completed)
  VALUES
    (btrim(p_illustration_handle), p_source, p_session_id,
     greatest(coalesce(p_listened_seconds, 0), 0), coalesce(p_completed, false))
  ON CONFLICT (session_id, illustration_handle, source, played_on) DO UPDATE SET
    listened_seconds = greatest(fragment_audio_plays.listened_seconds, excluded.listened_seconds),
    completed        = fragment_audio_plays.completed OR excluded.completed;
END;
$$;

COMMENT ON FUNCTION public.log_fragment_audio_play(text, text, text, integer, boolean) IS
  'Enregistre ou enrichit une écoute. greatest() et OR : un événement tardif ne peut
   que faire monter le compteur — un rembobinage ne défait pas une complétion.';

GRANT EXECUTE ON FUNCTION public.log_fragment_audio_play(text, text, text, integer, boolean) TO anon;
```

- [ ] **Step 2 : Preview de la migration**

```bash
node scripts/migration-preview.mjs supabase/migrations/340_fragment_audio_plays.sql
```

Attendu : aucune régression sémantique signalée. `log_fragment_audio_play` est une fonction neuve, il n'y a pas de version antérieure à diffuser — le script doit sortir en code 0.

- [ ] **Step 3 : Dry-run**

```bash
npx supabase db push --dry-run --linked
```

Attendu : `340_fragment_audio_plays.sql` listée comme seule migration en attente.

- [ ] **Step 4 : Appliquer**

```bash
npx supabase db push --linked
```

Attendu : application sans erreur.

- [ ] **Step 5 : Vérifier l'idempotence de l'écriture**

Via `mcp__plugin_supabase_supabase__execute_sql` :

```sql
select public.log_fragment_audio_play('__verif_340', 'motif', 'sess-verif-0001', 12, false);
select public.log_fragment_audio_play('__verif_340', 'motif', 'sess-verif-0001', 31, true);
select public.log_fragment_audio_play('__verif_340', 'motif', 'sess-verif-0001', 4,  false);

select count(*) as lignes, max(listened_seconds) as sec, bool_or(completed) as fini
  from public.fragment_audio_plays
 where illustration_handle = '__verif_340';
```

Attendu, exactement : `lignes = 1`, `sec = 31`, `fini = true`. Le troisième appel, plus faible et non complété, **ne doit pas** avoir fait redescendre les valeurs.

- [ ] **Step 6 : Vérifier le rejet des entrées hostiles**

```sql
select public.log_fragment_audio_play('',            'motif',   'sess-verif-0002', 20, true);
select public.log_fragment_audio_play('__verif_340', 'pirate',  'sess-verif-0002', 20, true);
select public.log_fragment_audio_play('__verif_340', 'motif',   'ab',              20, true);

select count(*) as lignes_parasites
  from public.fragment_audio_plays
 where session_id = 'sess-verif-0002' or illustration_handle = '';
```

Attendu : `lignes_parasites = 0`, et **aucune erreur** levée par les trois appels.

- [ ] **Step 7 : Vérifier que la table est bien fermée**

```sql
select has_table_privilege('anon',          'public.fragment_audio_plays', 'SELECT') as anon_select,
       has_table_privilege('anon',          'public.fragment_audio_plays', 'INSERT') as anon_insert,
       has_table_privilege('authenticated', 'public.fragment_audio_plays', 'SELECT') as auth_select,
       (select relrowsecurity from pg_class where oid = 'public.fragment_audio_plays'::regclass) as rls_on,
       (select count(*) from pg_policies where tablename = 'fragment_audio_plays') as policies;
```

Attendu : les trois privilèges à `false`, `rls_on = true`, `policies = 0`.

- [ ] **Step 8 : Nettoyer les lignes de vérification**

```sql
delete from public.fragment_audio_plays where illustration_handle = '__verif_340';
select count(*) as reste from public.fragment_audio_plays where illustration_handle = '__verif_340';
```

Attendu : `reste = 0`. La base est en production — on ne laisse pas de déchets de test.

- [ ] **Step 9 : Régénérer le graphe SQL**

```bash
python3 scripts/graphify-sql.py
```

- [ ] **Step 10 : Commit**

```bash
git add supabase/migrations/340_fragment_audio_plays.sql graphify-out/
git commit -m "feat(db): table et RPC d'écriture des écoutes de Fragments audio"
```

---

## Task 2 : RPC d'agrégat réservée au staff

**Files:**
- Create: `supabase/migrations/341_get_fragment_audio_stats.sql`

**Interfaces:**
- Consumes: la table `public.fragment_audio_plays` (tâche 1) et la fonction `public._is_staff()` définie en migration 337.
- Produces: `public.get_fragment_audio_stats()` renvoyant les colonnes `illustration_handle text`, `ecoutes bigint`, `completions bigint`, `taux numeric`, `ecoutes_motif bigint`, `ecoutes_produit bigint`, `derniere_ecoute timestamptz`. Exécutable par `authenticated`. La tâche 5 la consomme via `supabase.rpc('get_fragment_audio_stats')`.

- [ ] **Step 1 : Relire le motif de garde staff avant d'écrire**

Lire `supabase/migrations/337_emails_staff_only.sql`, section 1. Confirmer la signature exacte : `public._is_staff()` retourne `boolean`, `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER`. Ne pas réécrire cette fonction, ne pas en créer une variante — la réutiliser telle quelle.

- [ ] **Step 2 : Écrire la migration**

Créer `supabase/migrations/341_get_fragment_audio_stats.sql` :

```sql
-- 341 — Lecture des écoutes de Fragments audio, réservée au staff
--
-- WHY : la table de la mig 340 est fermée à tous les rôles. Le Hub a besoin de la
-- lire, mais `authenticated` c'est aussi n'importe lequel des ~4900 comptes joueur.
-- Même raisonnement que la vue users_admin (mig 337) : la garde est _is_staff(),
-- et le GRANT dit la même chose que le corps de la fonction.

CREATE OR REPLACE FUNCTION public.get_fragment_audio_stats()
RETURNS TABLE (
  illustration_handle text,
  ecoutes             bigint,
  completions         bigint,
  taux                numeric,
  ecoutes_motif       bigint,
  ecoutes_produit     bigint,
  derniere_ecoute     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.illustration_handle,
    count(*)                                            AS ecoutes,
    count(*) FILTER (WHERE p.completed)                 AS completions,
    round(100.0 * count(*) FILTER (WHERE p.completed) / nullif(count(*), 0), 1) AS taux,
    count(*) FILTER (WHERE p.source = 'motif')          AS ecoutes_motif,
    count(*) FILTER (WHERE p.source = 'produit')        AS ecoutes_produit,
    max(p.created_at)                                   AS derniere_ecoute
  FROM public.fragment_audio_plays p
  WHERE public._is_staff() OR (SELECT auth.role()) = 'service_role'
  GROUP BY p.illustration_handle
  ORDER BY taux DESC NULLS LAST, ecoutes DESC;
$$;

COMMENT ON FUNCTION public.get_fragment_audio_stats() IS
  'Agrégat des écoutes par Illustration, trié par taux de complétion — la colonne
   qui décide si la voix off reste au budget. Zéro ligne pour un non-staff.';

GRANT EXECUTE ON FUNCTION public.get_fragment_audio_stats() TO authenticated;
```

Le `WHERE public._is_staff()` est dans le corps et non dans un `IF ... RAISE` : un non-staff reçoit zéro ligne, pas une erreur — même comportement que la vue `users_admin`.

- [ ] **Step 3 : Preview, dry-run, apply**

```bash
node scripts/migration-preview.mjs supabase/migrations/341_get_fragment_audio_stats.sql
npx supabase db push --dry-run --linked
npx supabase db push --linked
```

Attendu : preview sans régression, dry-run listant `341`, apply sans erreur.

- [ ] **Step 4 : Vérifier le calcul sur données connues**

```sql
select public.log_fragment_audio_play('__verif_341', 'motif',   'sess-verif-0101', 30, true);
select public.log_fragment_audio_play('__verif_341', 'motif',   'sess-verif-0102', 12, false);
select public.log_fragment_audio_play('__verif_341', 'produit', 'sess-verif-0103', 44, true);

select * from public.get_fragment_audio_stats() where illustration_handle = '__verif_341';
```

Attendu, exactement : `ecoutes = 3`, `completions = 2`, `taux = 66.7`, `ecoutes_motif = 2`, `ecoutes_produit = 1`.

- [ ] **Step 5 : Vérifier la garde staff**

```sql
select has_function_privilege('anon', 'public.get_fragment_audio_stats()', 'EXECUTE') as anon_execute;
```

Attendu : `anon_execute = false`. La fonction n'est ouverte qu'à `authenticated`, et son corps filtre ensuite sur `_is_staff()`.

- [ ] **Step 6 : Nettoyer**

```sql
delete from public.fragment_audio_plays where illustration_handle = '__verif_341';
select count(*) as reste from public.fragment_audio_plays where illustration_handle like '__verif_%';
```

Attendu : `reste = 0`.

- [ ] **Step 7 : Régénérer le graphe et commit**

```bash
python3 scripts/graphify-sql.py
git add supabase/migrations/341_get_fragment_audio_stats.sql graphify-out/
git commit -m "feat(db): RPC d'agrégat des écoutes de Fragments audio, staff uniquement"
```

---

## Task 3 : Snippet partagé et branchement de la page motif

**Repo : thème Shopify** (`C:/Users/uriel/Desktop/DEVS/shopify (Runes de Chêne)/`)

**Files:**
- Create: `snippets/fragment-audio.liquid`
- Modify: `sections/rdc_motif.liquid` (bloc audio ~lignes 577-596 ; règles CSS `.rdcm__audio*` ~lignes 433-442)

**Interfaces:**
- Consumes: la RPC `log_fragment_audio_play` (tâche 1), appelée en POST sur `{{ supa_url }}/rest/v1/rpc/log_fragment_audio_play` avec le corps `{p_illustration_handle, p_source, p_session_id, p_listened_seconds, p_completed}`.
- Produces: le snippet `fragment-audio` acceptant les paramètres `ill` (métaobjet Illustration), `source` (`'motif'` ou `'produit'`), `audio_field_key`, `narrator_field_key`, `label`, `show_avatar`, `avatar_size`, `accent`, `supa_url`, `supa_key`. La tâche 4 l'appelle avec `source: 'produit'`.

- [ ] **Step 1 : Créer le snippet**

Créer `snippets/fragment-audio.liquid` :

```liquid
{%- comment -%}
  fragment-audio.liquid

  Le lecteur de voix off d'un Fragment, et sa mesure. Appele par la page motif
  (source 'motif') et par la fiche produit (source 'produit').

  Un seul endroit : le player et son tracking ne doivent PAS exister en deux
  exemplaires, sinon les deux surfaces divergent au premier correctif.

  Parametres :
    ill                - le metaobjet Illustration (obligatoire)
    source             - 'motif' ou 'produit' (obligatoire)
    audio_field_key    - cle du champ fichier audio        (defaut 'fragment_audio')
    narrator_field_key - cle du champ narrateur            (defaut 'narrateur_audio')
    label              - libelle affiche                    (defaut 'Écouter ce Fragment')
    show_avatar        - afficher l'avatar du narrateur      (defaut true)
    avatar_size        - taille de l'avatar en px            (defaut 34)
    accent             - couleur d'accent                    (defaut '#8a6a4a')
    supa_url / supa_key- surcharges Supabase                 (defaut : projet RdC)

  Si l'Illustration ne porte pas de fichier audio, RIEN n'est rendu.
{%- endcomment -%}

{%- liquid
  assign fa_key       = audio_field_key    | default: 'fragment_audio'
  assign fa_narr_key  = narrator_field_key | default: 'narrateur_audio'
  assign fa_label     = label              | default: 'Écouter ce Fragment'
  assign fa_avatar_px = avatar_size        | default: 34
  assign fa_accent    = accent             | default: '#8a6a4a'
  assign fa_supa_url  = supa_url           | default: 'https://ukpapqssgsxirsgmcvof.supabase.co'
  assign fa_supa_key  = supa_key           | default: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcGFwcXNzZ3N4aXJzZ21jdm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyOTU5OTMsImV4cCI6MjA4NTg3MTk5M30.Le1gdE3HhmZ2gzMJF9hVhlZVsILmLd5GQgk87xC_dUY'

  comment
    Meme double acces `.value` puis direct que partout ailleurs : selon le type
    de metachamp, Shopify renvoie l'un ou l'autre.
  endcomment
  assign fa_champ = ill[fa_key]
  assign fa_url   = fa_champ.value.url | default: fa_champ.url
  if fa_url == blank
    assign fa_url = fa_champ | metafield_text | strip
  endif

  assign fa_ref  = ill[fa_narr_key]
  assign fa_nom  = fa_ref.value.nom.value
  if fa_nom == blank
    assign fa_nom = fa_ref.value.nom
  endif
  if fa_nom == blank
    assign fa_nom = fa_ref.nom
  endif
  assign fa_face = fa_ref.value.image | default: fa_ref.image

  comment
    La cle de comptage. `system.handle` est stable et identique sur les deux
    surfaces, contrairement au tag produit `fragment:*` (cf. migs 251-253).
  endcomment
  assign fa_handle = ill.system.handle
  if fa_handle == blank
    assign fa_handle = collection.handle | default: product.handle
  endif

  assign fa_uid = 'fa-' | append: source | append: '-' | append: fa_handle
-%}

{%- if fa_url != blank -%}
  <style>
    .rdcfa{margin:0 0 26px}
    .rdcfa__label{display:flex;align-items:center;gap:10px;
      font-family:var(--font-body--family);font-size:.68rem;
      font-weight:600;letter-spacing:.18em;text-transform:uppercase;
      color:{{ fa_accent }};margin-bottom:10px}
    .rdcfa__avatar{width:{{ fa_avatar_px }}px;height:{{ fa_avatar_px }}px;
      border-radius:999px;object-fit:cover;flex:0 0 auto;
      box-shadow:0 0 0 2px {{ fa_accent }}55}
    .rdcfa__label strong{font-weight:700;color:#403434}
    .rdcfa audio{width:100%;max-width:420px;height:40px;display:block}
  </style>

  {%- comment -%}
    Pas d'autoplay : la voix demarre sur decision du visiteur. Et le lecteur
    natif du navigateur plutot qu'un composant maison — il est accessible au
    clavier et connu de tous.
  {%- endcomment -%}
  <div class="rdcfa">
    <div class="rdcfa__label">
      {%- if show_avatar != false and fa_face != blank -%}
        <img class="rdcfa__avatar" src="{{ fa_face | image_url: width: 96 }}"
             alt="{{ fa_nom | escape }}" width="96" height="96" loading="lazy">
      {%- endif -%}
      <span>{{ fa_label }}{% if fa_nom != blank %}, avec <strong>{{ fa_nom }}</strong>{% endif %}</span>
    </div>
    <audio id="{{ fa_uid }}" controls preload="none" src="{{ fa_url }}">
      Votre navigateur ne peut pas lire cet extrait.
      <a href="{{ fa_url }}">Télécharger la voix off</a>.
    </audio>
  </div>

  <script>
    (function () {
      var el = document.getElementById({{ fa_uid | json }});
      if (!el) return;

      var URL_BASE = {{ fa_supa_url | json }};
      var KEY      = {{ fa_supa_key | json }};
      var HANDLE   = {{ fa_handle | json }};
      var SOURCE   = {{ source | json }};
      if (!URL_BASE || !KEY || !HANDLE) return; // le lecteur marche, seule la mesure est muette

      // Identite de session. Bornee cote base par un index unique quotidien :
      // ce jeton n'est PAS la securite, il evite juste le bruit legitime.
      var SKEY = 'rdc_fa_sid';
      var sid;
      try {
        sid = sessionStorage.getItem(SKEY);
        if (!sid) {
          sid = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 12);
          sessionStorage.setItem(SKEY, sid);
        }
      } catch (e) {
        return; // navigation privee verrouillee : on ne mesure pas, on ne casse rien
      }

      var seuilAtteint = false;
      var envoye = false;

      function envoyer(complet) {
        var secondes = Math.floor(el.currentTime || 0);
        // Rien a dire tant que le seuil n'est pas franchi : un `play` de curiosite
        // de deux secondes n'est pas une ecoute.
        if (!seuilAtteint) return;
        if (envoye && !complet) return;
        envoye = true;
        fetch(URL_BASE + '/rest/v1/rpc/log_fragment_audio_play', {
          method: 'POST',
          keepalive: true, // sendBeacon ne permet pas de poser apikey/Authorization
          headers: {
            'Content-Type': 'application/json',
            'apikey': KEY,
            'Authorization': 'Bearer ' + KEY
          },
          body: JSON.stringify({
            p_illustration_handle: HANDLE,
            p_source: SOURCE,
            p_session_id: sid,
            p_listened_seconds: secondes,
            p_completed: !!complet
          })
        }).catch(function () {}); // la mesure ne doit jamais deranger le visiteur
      }

      el.addEventListener('timeupdate', function () {
        if (seuilAtteint) return;
        var duree = el.duration;
        var seuil = 10;
        if (duree && isFinite(duree)) seuil = Math.min(10, duree * 0.25);
        if ((el.currentTime || 0) >= seuil) {
          seuilAtteint = true;
          envoyer(false);
        }
      });

      el.addEventListener('ended', function () { envoyer(true); });

      // Le visiteur ferme l'onglet en pleine ecoute : on remonte le temps ecoute
      // avant de perdre la page.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && seuilAtteint && !el.ended) {
          envoye = false;
          envoyer(false);
        }
      });
    })();
  </script>
{%- endif -%}
```

- [ ] **Step 2 : Brancher la page motif sur le snippet**

Dans `sections/rdc_motif.liquid`, remplacer le bloc `{%- if s.audio_enabled and audio_url != blank -%}` … `{%- endif -%}` (~lignes 577-596) par :

```liquid
        {%- if s.audio_enabled -%}
          {%- render 'fragment-audio',
              ill: ill,
              source: 'motif',
              audio_field_key: s.audio_field_key,
              narrator_field_key: s.narrator_field_key,
              label: s.audio_label,
              show_avatar: s.audio_avatar,
              avatar_size: s.audio_avatar_size,
              accent: s.accent_color,
              supa_url: s.supabase_url,
              supa_key: s.supabase_anon_key -%}
        {%- endif -%}
```

Le test `audio_url != blank` disparaît d'ici : c'est le snippet qui décide de ne rien rendre s'il n'y a pas de fichier. Une seule règle, un seul endroit.

- [ ] **Step 3 : Supprimer les règles CSS devenues mortes**

Toujours dans `sections/rdc_motif.liquid`, supprimer les cinq règles `#{{ uid }} .rdcm__audio…` (~lignes 433-442). Elles ne s'appliquent plus à rien — le snippet porte ses propres styles, repris à l'identique. Ne pas les laisser « au cas où ».

- [ ] **Step 4 : Ajouter les réglages Supabase à la section**

Dans le bloc `{% schema %}` de `sections/rdc_motif.liquid`, à la suite de `audio_avatar_size`, ajouter :

```json
    { "type": "text", "id": "supabase_url", "label": "URL Supabase", "info": "Optionnel — laisser vide utilise le projet Runes de Chêne." },
    { "type": "text", "id": "supabase_anon_key", "label": "Clé Supabase (anon)", "info": "Optionnel — laisser vide utilise la clé publique par défaut." },
```

Mêmes intitulés que dans `rdc_fragment-app.liquid` : on ne fait pas deux vocabulaires pour un même réglage.

- [ ] **Step 5 : Pousser le thème sur l'environnement de test et relever le rendu**

Ouvrir `/collections/avalon`. Relever :
- Le bloc « Écouter ce Fragment » s'affiche, avec l'avatar du narrateur et son nom, **identique à avant** — comparer à une capture prise avant modification.
- Le lecteur natif fonctionne, la lecture démarre.

Si le rendu diffère (marge, couleur, taille d'avatar), c'est que la reprise CSS est incomplète : corriger le snippet, pas la section.

- [ ] **Step 6 : Relever la mesure de bout en bout**

Sur `/collections/avalon` : lancer l'audio, **couper à 3 secondes**. Puis via `mcp__plugin_supabase_supabase__execute_sql` :

```sql
select * from public.fragment_audio_plays order by created_at desc limit 5;
```

Attendu : **aucune ligne** pour ce motif. Le seuil fait son travail.

Puis relancer et laisser filer jusqu'au bout. Même requête.

Attendu : une ligne, `source = 'motif'`, `completed = true`, `illustration_handle` égal au handle du métaobjet Illustration d'Avalon (et non `avalon` par repli — si c'est le repli qui sort, `system.handle` ne répond pas et il faut le comprendre avant d'aller plus loin).

- [ ] **Step 7 : Commit (repo thème)**

```bash
cd "C:/Users/uriel/Desktop/DEVS/shopify (Runes de Chêne)"
git add snippets/fragment-audio.liquid sections/rdc_motif.liquid
git commit -m "feat(motif): extraction du lecteur audio en snippet partagé + mesure des écoutes"
```

---

## Task 4 : Branchement de la fiche produit

**Repo : thème Shopify**

**Files:**
- Modify: `sections/lecture-fragment-v2.liquid`

**Interfaces:**
- Consumes: le snippet `fragment-audio` (tâche 3) et la RPC `log_fragment_audio_play` (tâche 1).
- Produces: rien que d'autres tâches consomment.

- [ ] **Step 1 : Résoudre l'Illustration depuis le produit**

Dans `sections/lecture-fragment-v2.liquid`, dans le second bloc `{%- liquid ... -%}` (celui qui calcule `background_image_url`, après le `break`), ajouter en fin de bloc :

```liquid
  comment
    La section est alimentee par les reglages du customizer et ne connaissait
    aucun metaobjet. Le metachamp `illustration_produit` existe deja sur les
    produits — il est lu par rdc_fragment-app.liquid et rdc_saga-motifs.liquid.
    On emprunte le meme chemin plutot que d'en inventer un.
  endcomment
  assign ill_produit = product.metafields.custom.illustration_produit.value
```

- [ ] **Step 2 : Appeler le snippet**

Dans le même fichier, juste après le bloc `lecture-fragment__artist` et **avant** la fermeture de `</div>` de `lecture-fragment__text-content`, insérer :

```liquid
          {%- if ill_produit != blank -%}
            {%- render 'fragment-audio',
                ill: ill_produit,
                source: 'produit',
                label: section.settings.audio_label,
                accent: section.settings.audio_accent -%}
          {%- endif -%}
```

Les clés de métachamps, l'avatar et sa taille prennent les valeurs par défaut du snippet : la fiche produit n'a pas besoin de les régler séparément, et deux jeux de réglages pour un même lecteur sont une dette.

- [ ] **Step 3 : Ajouter les deux réglages de section**

Dans le `{% schema %}` de `sections/lecture-fragment-v2.liquid`, ajouter aux `settings` :

```json
    { "type": "text",  "id": "audio_label",  "label": "Libellé du lecteur audio", "default": "Écouter ce Fragment" },
    { "type": "color", "id": "audio_accent", "label": "Couleur d'accent du lecteur", "default": "#8a6a4a" },
```

- [ ] **Step 4 : Relever le rendu**

Ouvrir une fiche produit dont le métachamp `illustration_produit` pointe une Illustration **portant un fichier audio**. Relever :
- Le lecteur apparaît sous le texte du Fragment, dans le bloc « lire le Fragment ».
- Ouvrir ensuite une fiche produit dont l'Illustration n'a **pas** de fichier audio : rien ne s'affiche, aucun cadre vide, aucun espace mort.

- [ ] **Step 5 : Relever la mesure et la séparation des surfaces**

Écouter jusqu'au bout sur la fiche produit, puis :

```sql
select illustration_handle, source, completed, listened_seconds
  from public.fragment_audio_plays
 order by created_at desc limit 5;
```

Attendu : une ligne `source = 'produit'`. Si le même Fragment a déjà été écouté sur la page motif dans la même session, il doit y avoir **deux lignes distinctes** — même handle, même session, sources différentes. C'est exactement ce que l'index unique doit permettre.

- [ ] **Step 6 : Commit (repo thème)**

```bash
cd "C:/Users/uriel/Desktop/DEVS/shopify (Runes de Chêne)"
git add sections/lecture-fragment-v2.liquid
git commit -m "feat(produit): lecteur de Fragment audio sur la fiche produit"
```

---

## Task 5 : Écran Hub — tableau des écoutes

**Repo : monorepo app**

**Files:**
- Create: `apps/hub/src/components/FragmentsAudio.tsx`
- Modify: `apps/hub/src/App.tsx` (~ligne 122, à la suite de la route `/shopify/sync`)
- Modify: `apps/hub/src/components/Sidebar.tsx` (~ligne 74, sous la section Shopify)

**Interfaces:**
- Consumes: `public.get_fragment_audio_stats()` (tâche 2) et le client `supabase` de `apps/hub/src/lib/supabase`.
- Produces: le composant exporté `FragmentsAudio` et le type exporté `FragmentAudioStat`. La tâche 6 ajoute un bandeau **dans** ce composant.

- [ ] **Step 1 : Écrire le composant**

Créer `apps/hub/src/components/FragmentsAudio.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface FragmentAudioStat {
  illustration_handle: string
  ecoutes: number
  completions: number
  taux: number | null
  ecoutes_motif: number
  ecoutes_produit: number
  derniere_ecoute: string | null
}

export function FragmentsAudio() {
  const [stats, setStats] = useState<FragmentAudioStat[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    async function charger() {
      const { data, error } = await supabase.rpc('get_fragment_audio_stats')
      if (!vivant) return
      if (error) {
        setErreur(error.message)
      } else {
        setStats((data ?? []) as FragmentAudioStat[])
      }
      setLoading(false)
    }
    void charger()
    return () => { vivant = false }
  }, [])

  if (loading) return <div className="page">Chargement…</div>
  if (erreur) return <div className="page">Erreur de chargement : {erreur}</div>

  const totalEcoutes = stats.reduce((n, s) => n + s.ecoutes, 0)
  const totalCompletions = stats.reduce((n, s) => n + s.completions, 0)
  const tauxGlobal = totalEcoutes > 0
    ? Math.round((1000 * totalCompletions) / totalEcoutes) / 10
    : null

  return (
    <div className="page">
      <h1>Fragments audio</h1>
      <p>
        Le taux de complétion est la colonne qui décide : c&apos;est lui qui dit si la voix off
        mérite de rester au budget de chaque drop. Les écoutes de moins de dix secondes ne sont
        pas comptées.
      </p>

      {stats.length === 0 ? (
        <p>Aucune écoute enregistrée pour l&apos;instant.</p>
      ) : (
        <>
          <p>
            <strong>{totalEcoutes}</strong> écoutes, <strong>{totalCompletions}</strong> allées au
            bout{tauxGlobal !== null ? <> — <strong>{tauxGlobal} %</strong> de complétion</> : null}
          </p>
          <table>
            <thead>
              <tr>
                <th>Fragment</th>
                <th>Écoutes</th>
                <th>Complétions</th>
                <th>Taux</th>
                <th>Page motif</th>
                <th>Fiche produit</th>
                <th>Dernière écoute</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.illustration_handle}>
                  <td>{s.illustration_handle}</td>
                  <td>{s.ecoutes}</td>
                  <td>{s.completions}</td>
                  <td>{s.taux !== null ? `${s.taux} %` : '—'}</td>
                  <td>{s.ecoutes_motif}</td>
                  <td>{s.ecoutes_produit}</td>
                  <td>
                    {s.derniere_ecoute
                      ? new Date(s.derniere_ecoute).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
```

Le tri vient de la RPC (`ORDER BY taux DESC`), pas du composant : une seule autorité sur l'ordre.

- [ ] **Step 2 : Déclarer la route**

Dans `apps/hub/src/App.tsx`, ajouter l'import auprès des autres imports de composants :

```tsx
import { FragmentsAudio } from './components/FragmentsAudio'
```

puis la route, juste après `<Route path="/shopify/sync" element={<ShopifySync />} />` :

```tsx
          <Route path="/shopify/fragments-audio" element={<FragmentsAudio />} />
```

- [ ] **Step 3 : Ajouter l'entrée de menu**

Dans `apps/hub/src/components/Sidebar.tsx`, juste après la ligne `<NavLink to="/shopify/sync" …>Synchro Emails</NavLink>` :

```tsx
            <NavLink to="/shopify/fragments-audio" className={({ isActive }) => isActive ? 'active' : ''}>Fragments audio</NavLink>
```

- [ ] **Step 4 : Build**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm --filter hub build
```

Attendu : TSC strict et Vite passent sans erreur ni avertissement de type.

- [ ] **Step 5 : Relever l'écran**

`pnpm --filter hub dev`, se connecter avec un compte staff, ouvrir « Fragments audio » dans le menu Shopify. Relever :
- Le tableau affiche les Fragments réellement écoutés lors des tâches 3 et 4.
- Les chiffres correspondent, ligne pour ligne, à :

```sql
select * from public.get_fragment_audio_stats();
```

- Le tri place bien le meilleur taux de complétion en haut.

- [ ] **Step 6 : Commit**

```bash
git add apps/hub/src/components/FragmentsAudio.tsx apps/hub/src/App.tsx apps/hub/src/components/Sidebar.tsx
git commit -m "feat(hub): écran des écoutes de Fragments audio"
```

---

## Task 6 : Bandeau de couverture

**Repo : monorepo app**

**Files:**
- Create: `apps/hub/src/lib/shopifyIllustrations.ts`
- Modify: `apps/hub/src/components/FragmentsAudio.tsx`
- Modify: `apps/hub/CLAUDE.md`

**Interfaces:**
- Consumes: le proxy `/.netlify/functions/shopify-proxy?endpoint=graphql.json&shop=…` — même mécanique que `apps/hub/src/lib/shopifyProducts.ts`, dont il faut reprendre `authHeader()` et `proxyUrl()` à l'identique. Consomme aussi `FragmentAudioStat` (tâche 5).
- Produces: `fetchIllustrations(): Promise<IllustrationInfo[]>` et `fetchProduitsSansIllustration(): Promise<ProduitSansIllustration[]>`.

C'est la tâche la plus incertaine du plan : elle dépend de la définition des métaobjets côté admin Shopify, que le code ne connaît pas. D'où l'étape de découverte en premier — **ne pas deviner le type de métaobjet ni les clés de champ.**

- [ ] **Step 1 : Découvrir la définition des métaobjets**

Lancer le Hub en dev, se connecter en staff, et exécuter dans la console du navigateur :

```js
const { data: { session } } = await window.supabase.auth.getSession()
const r = await fetch('/.netlify/functions/shopify-proxy?endpoint=graphql.json&shop=runes-de-chene.myshopify.com', {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `{ metaobjectDefinitions(first: 20) { edges { node { type name fieldDefinitions { key name type { name } } } } } }` })
})
console.info(JSON.stringify((await r.json()).data, null, 2))
```

Noter le `type` exact de la définition « Illustration » et la clé exacte du champ fichier audio (attendu `fragment_audio`, à confirmer). **Reporter ces deux valeurs dans l'étape suivante** — si elles diffèrent de l'attendu, c'est la valeur relevée qui gagne.

Si `window.supabase` n'est pas exposé, ajouter temporairement `window.supabase = supabase` dans `apps/hub/src/lib/supabase.ts`, relever, puis retirer avant commit.

- [ ] **Step 2 : Écrire le module d'interrogation**

Créer `apps/hub/src/lib/shopifyIllustrations.ts`. Remplacer `ILLUSTRATION_TYPE` et `AUDIO_FIELD_KEY` par les valeurs relevées à l'étape 1 :

```ts
// apps/hub/src/lib/shopifyIllustrations.ts
// Inventaire des metaobjets Illustration et des produits qui y sont relies, via le
// proxy admin-authed. Sert le bandeau de couverture de l'ecran Fragments audio :
// un metachamp oublie au drop rend le lecteur muet sans aucun signal.
import { supabase } from './supabase'

const SHOP = 'runes-de-chene.myshopify.com'
const ILLUSTRATION_TYPE = 'illustration'   // ← valeur relevée à l'étape 1
const AUDIO_FIELD_KEY = 'fragment_audio'   // ← valeur relevée à l'étape 1

export interface IllustrationInfo {
  handle: string
  nom: string
  aAudio: boolean
}

export interface ProduitSansIllustration {
  handle: string
  titre: string
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const jwt = session?.access_token
  if (!jwt) throw new Error('Session expiree, reconnecte-toi')
  return { Authorization: `Bearer ${jwt}` }
}

function proxyUrl(endpoint: string): string {
  return `/.netlify/functions/shopify-proxy?endpoint=${encodeURIComponent(endpoint)}&shop=${SHOP}`
}

async function graphql<T>(query: string): Promise<T> {
  const resp = await fetch(proxyUrl('graphql.json'), {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!resp.ok) throw new Error(`Shopify Admin: HTTP ${resp.status}`)
  const json = await resp.json() as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) throw new Error(json.errors[0].message)
  if (!json.data) throw new Error('Shopify Admin: reponse vide')
  return json.data
}

/** Toutes les Illustrations, avec la presence ou non d'un fichier de voix off. */
export async function fetchIllustrations(): Promise<IllustrationInfo[]> {
  const query = `{
    metaobjects(type: "${ILLUSTRATION_TYPE}", first: 100) {
      edges { node { handle displayName fields { key value } } }
    }
  }`
  const data = await graphql<{
    metaobjects: { edges: Array<{ node: {
      handle: string
      displayName: string
      fields: Array<{ key: string; value: string | null }>
    } }> }
  }>(query)

  return data.metaobjects.edges.map(({ node }) => ({
    handle: node.handle,
    nom: node.displayName,
    aAudio: node.fields.some((f) => f.key === AUDIO_FIELD_KEY && !!f.value),
  }))
}

/** Produits dont le metachamp illustration_produit n'est pas renseigne. */
export async function fetchProduitsSansIllustration(): Promise<ProduitSansIllustration[]> {
  const query = `{
    products(first: 250) {
      edges { node {
        handle
        title
        status
        metafield(namespace: "custom", key: "illustration_produit") { value }
      } }
    }
  }`
  const data = await graphql<{
    products: { edges: Array<{ node: {
      handle: string
      title: string
      status: string
      metafield: { value: string | null } | null
    } }> }
  }>(query)

  return data.products.edges
    .filter(({ node }) => node.status === 'ACTIVE' && !node.metafield?.value)
    .map(({ node }) => ({ handle: node.handle, titre: node.title }))
}
```

Le filtre `status === 'ACTIVE'` est délibéré : un brouillon ou un produit archivé sans Illustration n'est pas un oubli, c'est du rangement normal.

- [ ] **Step 3 : Brancher le bandeau dans l'écran**

Dans `apps/hub/src/components/FragmentsAudio.tsx`, ajouter aux imports :

```tsx
import { fetchIllustrations, fetchProduitsSansIllustration } from '../lib/shopifyIllustrations'
import type { IllustrationInfo, ProduitSansIllustration } from '../lib/shopifyIllustrations'
```

ajouter les états, sous les états existants :

```tsx
  const [illustrations, setIllustrations] = useState<IllustrationInfo[]>([])
  const [produitsOrphelins, setProduitsOrphelins] = useState<ProduitSansIllustration[]>([])
  const [couvertureErreur, setCouvertureErreur] = useState<string | null>(null)
```

ajouter un second `useEffect`, après celui qui charge les stats :

```tsx
  useEffect(() => {
    let vivant = true
    async function charger() {
      try {
        const [ills, orphelins] = await Promise.all([
          fetchIllustrations(),
          fetchProduitsSansIllustration(),
        ])
        if (!vivant) return
        setIllustrations(ills)
        setProduitsOrphelins(orphelins)
      } catch (e) {
        if (!vivant) return
        setCouvertureErreur(e instanceof Error ? e.message : 'Erreur inconnue')
      }
    }
    void charger()
    return () => { vivant = false }
  }, [])
```

et le rendu, juste après le `<p>` d'introduction :

```tsx
      <section className="couverture">
        <h2>Couverture</h2>
        {couvertureErreur ? (
          <p>Inventaire Shopify indisponible : {couvertureErreur}</p>
        ) : (
          <ul>
            <li>
              <strong>{illustrations.filter((i) => !i.aAudio).length}</strong> Illustrations sans
              voix off :{' '}
              {illustrations.filter((i) => !i.aAudio).map((i) => i.nom).join(', ') || '—'}
            </li>
            <li>
              <strong>{produitsOrphelins.length}</strong> produits actifs sans Illustration reliée
              (le lecteur y est muet) :{' '}
              {produitsOrphelins.map((p) => p.titre).join(', ') || '—'}
            </li>
            <li>
              <strong>
                {illustrations.filter(
                  (i) => i.aAudio && !stats.some((s) => s.illustration_handle === i.handle),
                ).length}
              </strong>{' '}
              Fragments avec voix off et zéro écoute :{' '}
              {illustrations
                .filter((i) => i.aAudio && !stats.some((s) => s.illustration_handle === i.handle))
                .map((i) => i.nom)
                .join(', ') || '—'}
            </li>
          </ul>
        )}
      </section>
```

Une panne de l'inventaire Shopify n'empêche pas le tableau des écoutes de s'afficher : les deux chargements sont indépendants, et c'est voulu.

- [ ] **Step 4 : Build**

```bash
pnpm --filter hub build
```

Attendu : TSC strict passe. Aucun `any` n'a été introduit — si le typage des réponses GraphQL résiste, c'est le type qu'il faut lire, pas contourner.

- [ ] **Step 5 : Relever le bandeau**

Ouvrir l'écran en dev, compte staff. Relever :
- Les trois compteurs s'affichent avec des noms de Fragments réels, pas des handles techniques.
- Croiser une valeur à la main : prendre une Illustration listée « sans voix off » et vérifier dans l'admin Shopify que son champ audio est bien vide. Si elle a un fichier, `AUDIO_FIELD_KEY` est faux — retourner à l'étape 1.
- Le tableau des écoutes reste affiché même si le bandeau tombe en erreur (le vérifier en coupant le réseau le temps du chargement).

- [ ] **Step 6 : Documenter la sous-app**

Dans `apps/hub/CLAUDE.md`, ajouter une ligne à l'inventaire des écrans / helpers : `FragmentsAudio` (écran `/shopify/fragments-audio`) et `lib/shopifyIllustrations.ts` (inventaire Admin GraphQL des métaobjets Illustration).

- [ ] **Step 7 : Commit**

```bash
git add apps/hub/src/lib/shopifyIllustrations.ts apps/hub/src/components/FragmentsAudio.tsx apps/hub/CLAUDE.md
git commit -m "feat(hub): bandeau de couverture des Fragments audio"
```

---

## Livraison

- [ ] **Build complet**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm build
```

- [ ] **Push des deux repos**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && git push
cd "C:/Users/uriel/Desktop/DEVS/shopify (Runes de Chêne)" && git push
```

- [ ] **Déploiement Netlify manuel du Hub** — jamais d'auto-deploy Git.

- [ ] **Vérification finale en production** : ouvrir une page motif et une fiche produit publiques, écouter un Fragment jusqu'au bout sur chacune, puis confirmer les deux lignes dans le Hub. C'est le seul relevé qui compte.

## Hors périmètre — ne pas dériver

Rappel de la spec, pour l'implémenteur tenté d'en faire plus :

- Aucun bouton like, aucun compteur visible côté boutique.
- Aucune corrélation écoute → achat.
- Aucun branchement du récit `son_histoire` sur la fiche produit — la résolution ajoutée en tâche 4 le rendrait trivial, mais c'est une décision d'Uriel restée ouverte, pas un effet de bord à s'autoriser.
- Aucun harnais de test ajouté au Hub.
