# Cycle de vie carte des expéditions — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les bannières d'expédition dont le RDV est passé deviennent noir & blanc + s'estompent sur la carte pendant 7 jours, puis disparaissent et basculent dans les Archives publiques.

**Architecture:** On allume la machinerie d'archivage déjà construite mais jamais branchée. (1) SQL : brancher `archive_passed_voyages()` à un cron pg_cron horaire + ramener la fenêtre `passed → archived` de 30j à 7j + créer un RPC carte dédié `list_voyages_for_map()` (published + passed). (2) Front : un champ de store `mapBanners` distinct, alimenté par le nouveau RPC, et un rendu N&B + opacité dégressive calculé depuis `rdv_at`. (3) Masquer la section compte rendu (dormance, refonte parquée).

**Tech Stack:** Supabase Postgres (pg_cron, plpgsql SECURITY DEFINER), React 18 + TypeScript strict, Zustand, @vis.gl/react-maplibre, Vite.

**Note sur la vérification :** ce projet n'a pas de runner de tests unitaires. Le garde-fou est `pnpm build` (tsc strict + vite build) pour le front, et vérification SQL en prod pour la migration (cf. xo-discipline E1/B5). Chaque tâche se termine par un build/vérif + commit.

**Numéro de migration :** la dernière est `171`. La nouvelle est `172`.

---

### Task 1 : Migration SQL 172 — cron + fenêtre 7j + RPC carte

**Files:**
- Create: `supabase/migrations/172_v07_expeditions_map_lifecycle.sql`

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/172_v07_expeditions_map_lifecycle.sql` avec exactement ce contenu :

```sql
-- 172_v07_expeditions_map_lifecycle.sql
-- WHY : la machinerie d'archivage des voyages (mig 109) n'a jamais été branchée
-- à un cron (pg_cron n'était pas activé à l'époque ; il l'est depuis les push,
-- mig 144-146). Résultat : aucune expédition ne quitte jamais 'published', donc
-- les bannières restent sur la carte indéfiniment. On branche le cron, on ramène
-- la grâce carte de 30j à 7j (décision couplée : à J+7 → hors carte + Archives +
-- chat fermé d'un coup), et on ajoute un RPC dédié à la carte qui renvoie aussi
-- les 'passed' (pour le rendu N&B), sans toucher list_voyages_upcoming (qui
-- alimente la liste HUD "à venir" et doit rester published-only).
-- Cf. spec docs/superpowers/specs/2026-05-24-expeditions-map-lifecycle-design.md

-- ============================================================
-- 1. Redéfinir archive_passed_voyages : passed → archived à 7j (était 30j)
--    Copie intégrale de la baseline mig 109, seul l'interval passed→archived change.
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_passed_voyages()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_passed integer;
  v_archived integer;
  v_deleted integer;
BEGIN
  -- 1. published → passed (RDV atteint)
  UPDATE public.voyages
    SET status = 'passed', updated_at = now()
    WHERE status = 'published' AND rdv_at <= now();
  GET DIAGNOSTICS v_passed = ROW_COUNT;

  -- 2. passed → archived (7j après rdv_at) — grâce carte couplée
  UPDATE public.voyages
    SET status = 'archived', updated_at = now()
    WHERE status = 'passed' AND rdv_at + interval '7 days' <= now();
  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- 3. cancelled → suppression dure 30j après cancelled_at (inchangé)
  DELETE FROM public.voyages
    WHERE status = 'cancelled' AND cancelled_at + interval '30 days' <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN json_build_object(
    'passed', v_passed,
    'archived', v_archived,
    'deleted', v_deleted,
    'ran_at', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_passed_voyages() TO service_role;

-- ============================================================
-- 2. Brancher le cron horaire (pattern aligné mig 144). Minute 7 = hors pic.
-- ============================================================
SELECT cron.unschedule('archive_passed_voyages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive_passed_voyages');
SELECT cron.schedule(
  'archive_passed_voyages',
  '7 * * * *',
  $$ SELECT public.archive_passed_voyages(); $$
);

-- ============================================================
-- 3. RPC carte dédié : copie de list_voyages_upcoming (version courante mig 116)
--    avec un seul changement : WHERE status IN ('published','passed').
--    Renvoie le même shape (cover_image_url, unread_count, chief, status, rdv_at)
--    pour que ExpeditionBanner fonctionne sans changement de type.
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_voyages_for_map()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at ASC) INTO v_result FROM (
    SELECT
      v.id, v.name, v.rdv_at, v.rdv_lat, v.rdv_lng, v.rdv_label,
      v.call_text, v.cover_image_url,
      v.slots_max, v.slots_open, v.validation_mode, v.status,
      json_build_object(
        'user_id', u.id,
        'display_name', COALESCE(u.display_name, u.first_name, 'Voyageur'),
        'avatar_url', u.avatar_url,
        'faction_id', u.faction_id,
        'faction_title', f.title,
        'faction_color', f.color
      ) AS chief,
      (SELECT count(*) FROM public.voyage_participants p
       WHERE p.voyage_id = v.id AND p.status = 'validated') AS validated_count,
      CASE
        WHEN v_user_id IS NULL THEN 0
        WHEN v.chief_user_id = v_user_id OR EXISTS (
          SELECT 1 FROM public.voyage_participants p
          WHERE p.voyage_id = v.id AND p.user_id = v_user_id AND p.status = 'validated'
        ) THEN (
          SELECT count(*) FROM public.voyage_messages m
          WHERE m.voyage_id = v.id
            AND m.user_id <> v_user_id
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM public.voyage_message_reads
                WHERE voyage_id = v.id AND user_id = v_user_id),
              '-infinity'::timestamptz
            )
        )
        ELSE 0
      END AS unread_count
    FROM public.voyages v
    JOIN public.users u ON u.id = v.chief_user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id
    WHERE v.status IN ('published','passed')
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_voyages_for_map() TO authenticated;
```

- [ ] **Step 2 : Appliquer la migration**

Run (depuis la **racine du monorepo**, où vit `supabase/`) : `npx supabase db push`. Le CLAUDE.md monorepo impose `npx` pour supabase (seule exception à pnpm). Côté XO, on applique soi-même (xo-discipline B5).
Expected: la migration 172 s'applique sans erreur.

- [ ] **Step 3 : Vérifier en prod que le cron est bien planifié**

Run (SQL Editor Supabase ou MCP) :
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'archive_passed_voyages';
```
Expected: 1 ligne, `schedule = '7 * * * *'`, `active = true`.

- [ ] **Step 4 : Vérifier la transition (appel manuel one-shot)**

Run :
```sql
SELECT public.archive_passed_voyages();
```
Expected: un JSON `{"passed": N, "archived": M, "deleted": K, "ran_at": ...}`. Après ça, vérifier qu'aucune `voyages` avec `rdv_at <= now()` n'est encore `published` :
```sql
SELECT count(*) FROM public.voyages WHERE status = 'published' AND rdv_at <= now();
```
Expected: `0`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/172_v07_expeditions_map_lifecycle.sql
git commit -m "fix(explore-web): brancher le cron d'archivage des expeditions + grace carte 7j + RPC carte dedie"
```

---

### Task 2 : Store — champ `mapBanners` distinct

**Files:**
- Modify: `apps/explore-web/src/stores/expeditionsStore.ts`

- [ ] **Step 1 : Ajouter le champ et le setter à l'interface**

Dans `expeditionsStore.ts`, interface `ExpeditionsState`, ajouter après la ligne `upcoming: ExpeditionListItem[]` (ligne 18) :

```ts
  /** Bannières carte : published + passed (passed = rendu N&B + fade).
   *  Distinct de `upcoming` qui reste published-only pour la liste HUD. */
  mapBanners: ExpeditionListItem[]
```

Puis, dans le même bloc d'interface, après `setUpcoming: (l: ExpeditionListItem[]) => void` (ligne 33) :

```ts
  setMapBanners: (l: ExpeditionListItem[]) => void
```

- [ ] **Step 2 : Initialiser et implémenter dans le create**

Dans le `create<ExpeditionsState>(...)`, ajouter l'état initial après `upcoming: [],` (ligne 44) :

```ts
  mapBanners: [],
```

Et l'implémentation du setter après `setUpcoming: (l) => set({ upcoming: l }),` (ligne 52) :

```ts
  setMapBanners: (l) => set({ mapBanners: l }),
```

- [ ] **Step 3 : Build**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK (tsc strict + vite).

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/stores/expeditionsStore.ts
git commit -m "feat(explore-web): champ store mapBanners pour les bannieres carte"
```

---

### Task 3 : API wrapper `listExpeditionsForMap`

**Files:**
- Modify: `apps/explore-web/src/lib/expeditionsApi.ts`

- [ ] **Step 1 : Ajouter le wrapper**

Dans `expeditionsApi.ts`, juste après la fonction `listUpcomingExpeditions` (se termine ligne ~116), ajouter :

```ts
/**
 * Liste des expéditions à afficher sur la carte : 'published' + 'passed'.
 * Les 'passed' (RDV dépassé, < 7j) sont rendues en N&B + fade par ExpeditionBanner.
 * Distinct de listUpcomingExpeditions (published-only, pour la liste HUD).
 */
export async function listExpeditionsForMap(): Promise<ExpeditionListItem[]> {
  const { data, error } = await supabase.rpc('list_voyages_for_map')
  if (error) throw error
  return (data as ExpeditionListItem[] | null) ?? []
}
```

- [ ] **Step 2 : Build**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK.

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/lib/expeditionsApi.ts
git commit -m "feat(explore-web): wrapper listExpeditionsForMap (RPC list_voyages_for_map)"
```

---

### Task 4 : `ExpeditionBanners` consomme le nouveau RPC + store

**Files:**
- Modify: `apps/explore-web/src/components/map/markers/ExpeditionBanners.tsx`

- [ ] **Step 1 : Remplacer l'import et les sélecteurs de store**

Remplacer le contenu complet de `ExpeditionBanners.tsx` par :

```tsx
import { useEffect } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { useExpeditionsStore } from '../../../stores/expeditionsStore'
import { listExpeditionsForMap } from '../../../lib/expeditionsApi'
import { ExpeditionBanner } from './ExpeditionBanner'

/**
 * Pose une bannière sur la carte pour chaque expédition 'published' ou 'passed'.
 * Les 'passed' (RDV dépassé) sont rendues en N&B + fade par ExpeditionBanner ;
 * elles quittent la carte automatiquement à J+7 (cron archive_passed_voyages).
 * Tap → ouvre la modale via expeditionsStore.requestOpenExpedition.
 */
export function ExpeditionBanners() {
  const mapBanners = useExpeditionsStore((s) => s.mapBanners)
  const setMapBanners = useExpeditionsStore((s) => s.setMapBanners)
  const requestOpen = useExpeditionsStore((s) => s.requestOpenExpedition)

  // Charge la liste au mount (et la maintient via setInterval léger)
  useEffect(() => {
    let cancelled = false
    function load() {
      listExpeditionsForMap()
        .then((list) => { if (!cancelled) setMapBanners(list) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 60_000) // refresh toutes les minutes
    return () => { cancelled = true; clearInterval(interval) }
  }, [setMapBanners])

  return (
    <>
      {mapBanners.map((e) => (
        <Marker
          key={e.id}
          longitude={e.rdv_lng}
          latitude={e.rdv_lat}
          anchor="bottom"
        >
          <ExpeditionBanner
            expedition={e}
            onClick={() => requestOpen(e.id)}
          />
        </Marker>
      ))}
    </>
  )
}
```

- [ ] **Step 2 : Build**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK.

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/components/map/markers/ExpeditionBanners.tsx
git commit -m "feat(explore-web): carte alimentee par listExpeditionsForMap (published + passed)"
```

---

### Task 5 : `ExpeditionBanner` — rendu N&B + opacité dégressive

**Files:**
- Modify: `apps/explore-web/src/components/map/markers/ExpeditionBanner.tsx`
- Modify: `apps/explore-web/src/components/map/markers/ExpeditionBanner.css`

- [ ] **Step 1 : Calculer l'état "passé" et l'opacité**

Dans `ExpeditionBanner.tsx`, remplacer le bloc de calcul (lignes 23-40, de `const rdvAt` jusqu'au `.join(' ')`) par :

```tsx
  const rdvAt = expedition.rdv_at
  const day = 24 * 60 * 60 * 1000
  const diffMs = rdvAt ? new Date(rdvAt).getTime() - Date.now() : null

  const isUnset = rdvAt === null
  const isToday = diffMs !== null && diffMs >= -day && diffMs < day
  const isTomorrow = diffMs !== null && diffMs >= day && diffMs < 2 * day
  const isSoon = diffMs !== null && diffMs >= 2 * day && diffMs < 7 * day
  const isFuture = diffMs !== null && diffMs >= 7 * day

  // Expédition passée (plus de 24h après le RDV) : N&B + opacité dégressive
  // de 1.0 (J+1) à 0.35 (J+7). Le cron retire la bannière de la carte à J+7.
  // Calculé sur rdv_at (robuste au décalage ≤ 1h du cron de transition).
  const passedAgeDays = diffMs !== null && diffMs < 0 ? -diffMs / day : 0
  const isPassed = passedAgeDays > 1
  const passedOpacity = isPassed
    ? Math.max(0.35, 1 - (0.65 * (passedAgeDays - 1)) / 6)
    : 1

  const className = [
    'expedition-banner',
    isToday && 'is-today',
    isTomorrow && 'is-tomorrow',
    isSoon && 'is-soon',
    isFuture && 'is-future',
    isUnset && 'is-unset',
    isPassed && 'is-passed',
  ].filter(Boolean).join(' ')
```

- [ ] **Step 2 : Appliquer l'opacité sur le bouton**

Dans le même fichier, sur l'élément `<button>` (ligne ~52), ajouter l'attribut `style` après `title={expedition.name}` :

```tsx
      title={expedition.name}
      style={{ opacity: passedOpacity }}
```

- [ ] **Step 3 : Ajouter la règle CSS N&B**

Append à la fin de `ExpeditionBanner.css` :

```css
/* Expédition passée : médaillon en noir & blanc. L'opacité (fade J+1→J+7) est
   gérée inline par le composant. Cf. spec 2026-05-24-expeditions-map-lifecycle. */
.expedition-banner.is-passed {
  filter: grayscale(1);
  transition: opacity 0.4s ease, filter 0.4s ease;
}
```

- [ ] **Step 4 : Build**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK (pas de `any`, pas de `as`).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/map/markers/ExpeditionBanner.tsx apps/explore-web/src/components/map/markers/ExpeditionBanner.css
git commit -m "feat(explore-web): bannieres d'expedition passees en N&B + fade sur la carte"
```

---

### Task 6 : Masquer la section compte rendu (dormance)

**Files:**
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionModal.tsx`

- [ ] **Step 1 : Déclarer la constante de dormance**

Dans `ExpeditionModal.tsx`, juste avant la déclaration du composant principal (chercher `export function ExpeditionModal`), ajouter une constante au niveau module :

```tsx
// Section compte rendu masquée le 2026-05-24 en attendant la refonte
// "album-souvenir chef uniquement" (cf. Bible Game Design + spec
// 2026-05-24-expeditions-map-lifecycle). Les RPCs compte rendu restent en place
// (dormance UI uniquement). Repasser à true au moment de la refonte.
const REPORTS_SECTION_ENABLED = false
```

- [ ] **Step 2 : Garder la section derrière la constante**

Remplacer la condition d'ouverture de la section (ligne ~508) :

```tsx
        {/* Comptes rendus (date passée) */}
        {(e.status === 'passed' || e.status === 'archived') && (
```

par :

```tsx
        {/* Comptes rendus (date passée) — masqué en dormance (cf. REPORTS_SECTION_ENABLED) */}
        {REPORTS_SECTION_ENABLED && (e.status === 'passed' || e.status === 'archived') && (
```

- [ ] **Step 3 : Build**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK. ⚠️ Si tsc signale des variables désormais inutilisées (`reportEditorOpen`, `myReport`, `onReportSaved`, `ReportsList`, imports `ReportEditor`/`ExpeditionGallery`), NE PAS les supprimer (elles servent à la refonte future) : les neutraliser n'est pas souhaité. Si le build échoue pour "unused", préfixer la cause minimale — mais en pratique, comme `REPORTS_SECTION_ENABLED` est une `const false` (pas un littéral `false`), tsc ne fait pas d'élimination de branche et considère les symboles comme utilisés. Vérifier que le build passe ; s'il échoue réellement sur de l'unused, le consigner et demander avant de supprimer du code.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/components/expeditions/ExpeditionModal.tsx
git commit -m "chore(explore-web): masquer la section compte rendu (dormance, refonte parquee)"
```

---

### Task 7 : Doc sous-app + bump version (CHANGELOG)

**Files:**
- Modify: `apps/explore-web/CLAUDE.md`
- Modify: `apps/explore-web/CHANGELOG.md`

- [ ] **Step 1 : Noter le cycle de vie dans le CLAUDE.md sous-app**

Dans `apps/explore-web/CLAUDE.md`, dans la liste à puces "Spécificités cette app", ajouter une puce (après la ligne V0.7.9 Coupe des Héritages) :

```md
- V0.8.21 (24 mai 2026) : **cycle de vie carte des expéditions**. Le cron `archive_passed_voyages()` (mig 109, jamais branché) est enfin planifié via pg_cron (mig 172, horaire). Transition `passed → archived` ramenée à **7j** (grâce carte couplée : à J+7 → hors carte + Archives publiques + chat fermé). Nouveau RPC `list_voyages_for_map()` (published + passed) + champ store `mapBanners`, distinct de `list_voyages_upcoming`/`upcoming` (resté published-only pour la liste HUD). Bannières `passed` rendues en N&B + opacité dégressive (1.0→0.35 sur 7j) dans `ExpeditionBanner` (calcul sur `rdv_at`). Section compte rendu **masquée** (`REPORTS_SECTION_ENABLED=false` dans `ExpeditionModal`) en attendant la refonte "album-souvenir chef" (parquée, cf. Bible Game Design).
```

- [ ] **Step 2 : Bump version — entrée CHANGELOG en tête**

Dans `apps/explore-web/CHANGELOG.md`, insérer tout en haut du fichier (avant `# ALPHA V0.8.20`) :

```md
# ALPHA V0.8.21
## Les expéditions passées quittent la carte

Une fois la date d'une expédition dépassée, sa bannière restait sur la carte indéfiniment : le mécanisme d'archivage existait mais n'avait jamais été activé. Désormais, dès que le rendez-vous est passé, la bannière passe en noir & blanc et s'estompe doucement sur la carte pendant 7 jours, puis disparaît et rejoint les Archives. Un nettoyage automatique tourne toutes les heures.

---

```

- [ ] **Step 3 : Build (sanity — CHANGELOG est importé via ?raw)**

Run: `cd apps/explore-web && pnpm build`
Expected: build OK (le badge version lira `V0.8.21`).

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/CLAUDE.md apps/explore-web/CHANGELOG.md
git commit -m "docs(explore-web): doc cycle de vie carte expeditions + bump V0.8.21"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `cd apps/explore-web && pnpm build` global OK.
- [ ] En prod (après `db push`) : `SELECT * FROM cron.job WHERE jobname='archive_passed_voyages'` → présent, actif.
- [ ] Sur la carte : une expédition au RDV passé depuis >24h apparaît en N&B et plus pâle ; une expédition future reste en couleur ; une expédition "date à définir" (`rdv_at` NULL) reste en couleur.
- [ ] Une expédition au RDV passé depuis >7j ne s'affiche plus sur la carte et apparaît dans les Archives.
- [ ] La liste HUD "à venir" (panneau Quêtes) n'affiche **pas** les expéditions passées (RPC `list_voyages_upcoming` inchangé).
- [ ] La modale d'une expédition passée n'affiche **pas** de section "Comptes rendus" (dormance).

## Hors périmètre (rappel spec)

- Refonte "album-souvenir chef uniquement" → chantier dédié (idée parquée dans la Bible Game Design).
- Notif "ton expédition est passée, raconte-la" → hors scope tant que les comptes rendus sont en dormance.
- Cleanup blobs Storage orphelins → inchangé (note mig 109).
