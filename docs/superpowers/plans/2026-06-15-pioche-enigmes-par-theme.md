# Pioche d'énigmes par Thème — Implementation Plan (Livrable A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découpler la pioche des énigmes de fragment de la mécanique faction : pioche + affichage par `theme` (table `enigma_themes`), suppression de `enigmas.heritage_id`, macaron de thème sur la quotidienne.

**Architecture:** 3 migrations SQL séquentielles (schéma → RPC → drop) appliquées via `db push --linked`, puis 3 fichiers front (1 explore-web + 2 hub). Les RPC sont réécrites selon la procédure « def live verbatim » + `migration-preview.mjs`. Le DROP de colonne arrive APRÈS la bascule des RPC.

**Tech Stack:** PostgreSQL (Supabase), plpgsql SECURITY DEFINER, React 18 + TS strict (Vite), Supabase JS.

**Référence spec :** `docs/superpowers/specs/2026-06-15-pioche-enigmes-par-theme-design.md`

**Règles transverses (lire avant de commencer) :**
- `docs/db/migrations-workflow.md` — canal unique `npx supabase db push --linked`, JAMAIS MCP `apply_migration` ni dashboard.
- `docs/db/gotchas.md` — « Lire avant de réécrire » : `pg_get_functiondef` = source de vérité.
- Numéros de migration séquentiels uniques. Confirmer le prochain libre avec :
  `ls supabase/migrations | sort | tail -3` (ce plan suppose **258, 259, 260** libres).
- Après chaque migration appliquée : `python3 scripts/graphify-sql.py` (idempotent).
- DB = **prod alpha**. Tester chaque migration sur données réelles. Pas de backfill destructif.

---

### Task 1 : Migration 258 — schéma `enigma_themes` + FK + colonne fragment + backfill

**Files:**
- Create: `supabase/migrations/258_enigma_themes.sql`

- [ ] **Step 1 : Vérifier le numéro de migration libre**

Run: `ls supabase/migrations | sort | tail -3`
Expected: le plus haut est `257_handle_new_user_concurrency_guard.sql` → 258 est libre. Si un 258 existe déjà, incrémenter tous les numéros de ce plan.

- [ ] **Step 2 : Écrire la migration**

Create `supabase/migrations/258_enigma_themes.sql` :

```sql
-- 258_enigma_themes.sql
-- WHY : Decouple la pioche d'enigmes de la mecanique faction. Cree la table de
-- reference des themes culturels (enigma_themes) : cle de pioche des motifs ET
-- source du macaron de theme sur la quotidienne. Etape 1/3 (schema + seed + FK +
-- colonne fragment + backfill). RPC en 259, DROP enigmas.heritage_id en 260.

BEGIN;

CREATE TABLE IF NOT EXISTS public.enigma_themes (
  id         text PRIMARY KEY,
  label      text NOT NULL,
  color      text,
  icon       text,
  sort_order int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

-- Seed dynamique depuis les valeurs distinctes existantes (garantit une FK valide)
INSERT INTO public.enigma_themes (id, label)
SELECT DISTINCT theme, initcap(theme)
FROM public.enigmas
WHERE theme IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Libelle lisible + couleur pour la Grece
UPDATE public.enigma_themes
SET label = 'Grèce Antique', color = '#1d4e89', sort_order = 10
WHERE id = 'grecque';

-- Couleurs des themes miroir depuis leur faction homonyme (one-shot, sans coupling runtime)
UPDATE public.enigma_themes et
SET color = f.color
FROM public.factions f
WHERE f.id = 'faction-' || et.id AND et.color IS NULL;

-- FK enigmas.theme -> enigma_themes (apres le seed)
ALTER TABLE public.enigmas
  ADD CONSTRAINT enigmas_theme_fkey FOREIGN KEY (theme) REFERENCES public.enigma_themes(id);

-- Colonne de pioche du motif
ALTER TABLE public.title_fragments
  ADD COLUMN IF NOT EXISTS theme text REFERENCES public.enigma_themes(id);

-- Backfill fragment.theme depuis le miroir faction 1:1 (cf. backfill mig 009)
UPDATE public.title_fragments SET theme = CASE collection
  WHEN 'faction-celtique'  THEN 'celtique'
  WHEN 'faction-nordique'  THEN 'nordique'
  WHEN 'faction-romaine'   THEN 'romaine'
  WHEN 'faction-byzantine' THEN 'byzantine'
  ELSE theme END
WHERE theme IS NULL;

COMMIT;
```

- [ ] **Step 3 : Dry-run (contrôle de ce qui sera appliqué)**

Run: `npx supabase db push --dry-run --linked`
Expected: liste qui inclut `258_enigma_themes.sql`, aucune autre migration surprise.

- [ ] **Step 4 : Appliquer**

Run: `npx supabase db push --linked`
Expected: applique 258 sans erreur (notamment l'`ADD CONSTRAINT enigmas_theme_fkey` ne doit PAS échouer → preuve que tout `theme` distinct est seedé).

- [ ] **Step 5 : Vérifier le résultat**

Run (via `npx supabase` ou MCP `execute_sql`) :
```sql
SELECT id, label, color FROM public.enigma_themes ORDER BY sort_order, id;
SELECT count(*) FILTER (WHERE theme IS NOT NULL) AS frags_avec_theme,
       count(*) FILTER (WHERE theme IS NULL) AS frags_sans_theme
FROM public.title_fragments;
```
Expected: au moins `grecque` (« Grèce Antique ») + les 4 thèmes miroir ; `grecque` a une couleur ; les fragments rattachés à une faction connue ont un `theme` non-null.

- [ ] **Step 6 : Régénérer le graphe SQL**

Run: `python3 scripts/graphify-sql.py`
Expected: `enigma_themes` apparaît comme nouveau nœud.

- [ ] **Step 7 : Commit**

```bash
git add supabase/migrations/258_enigma_themes.sql graphify-out/
git commit -m "feat(enigmes): table enigma_themes + FK + theme sur fragments (mig 258)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2 : Migration 259 — basculer les 3 RPC sur `theme`

**Files:**
- Create: `supabase/migrations/259_enigma_pioche_par_theme.sql`

**Méthode (gotchas)** : pour CHAQUE fonction, récupérer la **def LIVE**, la coller dans la
migration, puis appliquer UNIQUEMENT le delta montré ci-dessous.

- [ ] **Step 1 : Récupérer les 3 défs live**

Run (MCP `execute_sql` ou `npx supabase`) :
```sql
SELECT pg_get_functiondef('public.get_fragment_enigma(text,integer)'::regprocedure);
SELECT pg_get_functiondef('public.get_my_fragment_status(text)'::regprocedure);
SELECT pg_get_functiondef('public.get_daily_enigma(text)'::regprocedure);
```
Expected: 3 corps complets. Ce sont la base à coller verbatim dans la migration.

- [ ] **Step 2 : Écrire la migration en appliquant les deltas exacts**

Create `supabase/migrations/259_enigma_pioche_par_theme.sql`. Coller les 3 défs live
récupérées au Step 1, puis appliquer ces deltas (et RIEN d'autre) :

**`get_fragment_enigma`** — 3 changements :
1. Renommer la variable de travail et sa source :
   - `DECLARE v_collection TEXT;` → `DECLARE v_theme TEXT;`
   - `SELECT collection INTO v_collection FROM title_fragments WHERE id = p_fragment_id;`
     → `SELECT theme INTO v_theme FROM title_fragments WHERE id = p_fragment_id;`
   - `IF v_collection IS NULL THEN RETURN json_build_object('error', 'no_collection');`
     → `IF v_theme IS NULL THEN RETURN json_build_object('error', 'no_theme');`
2. Les 3 occurrences `e.heritage_id = v_collection` → `e.theme = v_theme`
   (le bloc `already_today` + les 2 SELECT de pioche ; le 3e repli « n'importe quelle daily »
   reste sans clause thème).
3. JSON retourné : `'heritageId', v_enigma.heritage_id,` → `'theme', v_enigma.theme,`.

**`get_my_fragment_status`** — 1 changement (champ `hasEnigma`) :
```sql
-- AVANT
'hasEnigma', tf.collection IS NOT NULL AND EXISTS(
  SELECT 1 FROM enigmas e WHERE e.type = 'daily' AND e.heritage_id = tf.collection AND e.active = TRUE
),
-- APRES
'hasEnigma', tf.theme IS NOT NULL AND EXISTS(
  SELECT 1 FROM enigmas e WHERE e.type = 'daily' AND e.theme = tf.theme AND e.active = TRUE
),
```
(Conserver `'collection', tf.collection` juste au-dessus — inchangé.)

**`get_daily_enigma`** — 1 changement (champ retourné dans le `json_build_object` du
`v_result`) :
```sql
-- AVANT
'heritageId', v_enigma.heritage_id,
-- APRES
'theme', v_enigma.theme,
```
(Le filtrage du pool ne change PAS : toujours `WHERE type='daily' AND active AND difficulty=...`.)

Conserver pour les 3 fonctions : `LANGUAGE plpgsql SECURITY DEFINER`, les `GRANT EXECUTE`,
et tout le reste verbatim.

- [ ] **Step 3 : Preview obligatoire (garde-fou régression)**

Run: `node scripts/migration-preview.mjs supabase/migrations/259_enigma_pioche_par_theme.sql`
Expected: le diff ne montre QUE les deltas ci-dessus (variable theme, clauses `e.theme`,
error string `no_theme`, champ retourné `theme`). **Si autre chose a bougé (limites, gains,
autre champ JSON) → STOP, corriger avant apply.**

- [ ] **Step 4 : Dry-run + appliquer**

Run: `npx supabase db push --dry-run --linked` puis `npx supabase db push --linked`
Expected: applique 259 sans erreur.

- [ ] **Step 5 : Vérifier que les 3 défs live référencent `theme` et plus `heritage_id`**

Run:
```sql
SELECT proname,
       pg_get_functiondef(oid) ~ 'heritage_id' AS contient_heritage_id,
       pg_get_functiondef(oid) ~ '\mtheme\M'   AS contient_theme
FROM pg_proc
WHERE proname IN ('get_fragment_enigma','get_my_fragment_status','get_daily_enigma')
  AND pronamespace = 'public'::regnamespace;
```
Expected: `contient_heritage_id = false` ET `contient_theme = true` pour les 3.

- [ ] **Step 6 : Régénérer le graphe + commit**

```bash
python3 scripts/graphify-sql.py
git add supabase/migrations/259_enigma_pioche_par_theme.sql graphify-out/
git commit -m "refactor(enigmes): pioche + retour des 3 RPC par theme (mig 259)

get_fragment_enigma, get_my_fragment_status, get_daily_enigma : plus
de heritage_id, tout passe par enigmas.theme / title_fragments.theme.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : Migration 260 — DROP `enigmas.heritage_id` + FK

**Files:**
- Create: `supabase/migrations/260_drop_enigmas_heritage_id.sql`

- [ ] **Step 1 : Confirmer qu'aucune RPC live ne référence plus la colonne**

Run:
```sql
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND pg_get_functiondef(oid) ~ '\menigmas\M[^;]*heritage_id|e\.heritage_id|v_enigma\.heritage_id';
```
Expected: **0 ligne**. Si une fonction remonte → la traiter avant de droper.

- [ ] **Step 2 : Écrire la migration**

Create `supabase/migrations/260_drop_enigmas_heritage_id.sql` :
```sql
-- 260_drop_enigmas_heritage_id.sql
-- WHY : Etape 3/3 du decouplage faction. Plus aucune RPC live ne reference
-- enigmas.heritage_id (migre vers theme en 259). On supprime la colonne et sa FK
-- (enigmas_heritage_id_fkey -> factions). L'affichage utilise desormais le macaron
-- de theme (enigma.theme -> enigma_themes).

BEGIN;
ALTER TABLE public.enigmas DROP CONSTRAINT IF EXISTS enigmas_heritage_id_fkey;
ALTER TABLE public.enigmas DROP COLUMN IF EXISTS heritage_id;
COMMIT;
```

- [ ] **Step 3 : Dry-run + appliquer**

Run: `npx supabase db push --dry-run --linked` puis `npx supabase db push --linked`
Expected: applique 260 sans erreur.

- [ ] **Step 4 : Vérifier la suppression**

Run:
```sql
SELECT count(*) AS reste
FROM information_schema.columns
WHERE table_schema='public' AND table_name='enigmas' AND column_name='heritage_id';
```
Expected: `reste = 0`.

- [ ] **Step 5 : Régénérer le graphe + commit**

```bash
python3 scripts/graphify-sql.py
git add supabase/migrations/260_drop_enigmas_heritage_id.sql graphify-out/
git commit -m "feat(enigmes): DROP enigmas.heritage_id + FK faction (mig 260)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : `DailyEnigma.tsx` — macaron de thème à la place du badge faction

**Files:**
- Modify: `apps/explore-web/src/components/enigma/DailyEnigma.tsx`

- [ ] **Step 1 : Type `Enigma` et mapping RPC → `theme`**

Dans l'interface `Enigma` (l.13-23), remplacer :
```ts
  heritageId: string | null
```
par :
```ts
  theme: string | null
```
Dans le mapping du retour `get_daily_enigma` (l.113-123), remplacer :
```ts
          heritageId: e.heritageId as string | null,
```
par :
```ts
          theme: e.theme as string | null,
```

- [ ] **Step 2 : Remplacer le state/fetch `factions` par `themes`**

Remplacer le state (l.75) :
```ts
  const [factions, setFactions] = useState<Map<string, { color: string; pattern: string; title: string; adjective: string }>>(new Map())
```
par :
```ts
  const [themes, setThemes] = useState<Map<string, { label: string; color: string | null; icon: string | null }>>(new Map())
```
Remplacer le `useEffect` de chargement (l.77-87) :
```ts
  // Load theme visuals once (macaron)
  useEffect(() => {
    supabase.from('enigma_themes').select('id, label, color, icon').then(({ data }) => {
      if (!data) return
      const map = new Map<string, { label: string; color: string | null; icon: string | null }>()
      for (const t of data as Array<{ id: string; label: string; color: string | null; icon: string | null }>) {
        map.set(t.id, { label: t.label, color: t.color, icon: t.icon })
      }
      setThemes(map)
    })
  }, [])
```

- [ ] **Step 3 : Remplacer la pilule faction par le macaron de thème**

Remplacer le bloc (l.236-253, `enigma.heritageId && factions.get(...)`) par :
```tsx
              {enigma.theme && themes.get(enigma.theme) && (() => {
                const t = themes.get(enigma.theme!)!
                const c = t.color ?? '#c19a6b'
                return (
                  <div className="enigma-heritage-pill" style={{ backgroundColor: `${c}20`, color: c }}>
                    {t.icon && (
                      <span
                        className="enigma-heritage-icon"
                        style={{
                          WebkitMaskImage: `url(${t.icon})`,
                          maskImage: `url(${t.icon})`,
                          backgroundColor: c,
                        }}
                      />
                    )}
                    {t.label}
                  </div>
                )
              })()}
```
(On garde les classes CSS existantes `enigma-heritage-pill` / `enigma-heritage-icon`.)

- [ ] **Step 4 : Vérifier le build (tsc strict)**

Run: `pnpm --filter explore-web build`
Expected: build OK, zéro erreur TS (notamment plus aucune référence à `heritageId` ni `factions` dans ce fichier).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/enigma/DailyEnigma.tsx
git commit -m "feat(enigmes): macaron de theme sur la quotidienne (remplace badge faction)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : Hub `Enigmas.tsx` — menu « Thème », retrait du menu faction

**Files:**
- Modify: `apps/hub/src/components/Enigmas.tsx`

- [ ] **Step 1 : Types & état**

Dans l'interface `Enigma` (l.9-23), remplacer `heritage_id: string | null` par `theme: string | null`.
Remplacer l'interface `Faction` (l.25-28) par :
```ts
interface Theme {
  id: string
  label: string
}
```
Dans `EMPTY_ENIGMA` (l.56-68), remplacer `heritage_id: null,` par `theme: null,`.
Remplacer le state `factions` (l.73) par :
```ts
  const [themes, setThemes] = useState<Theme[]>([])
```
Remplacer le filtre `filterHeritage` (l.82) par `const [filterTheme, setFilterTheme] = useState<string>('all')`.

- [ ] **Step 2 : Fetch**

Dans `fetchData` (l.98-124), remplacer la ligne de fetch factions :
```ts
        supabase.from('factions').select('id, title').order('title'),
```
par :
```ts
        supabase.from('enigma_themes').select('id, label').order('sort_order'),
```
Adapter la destructuration `[enigmasRes, factionsRes, tagsRes]` → `[enigmasRes, themesRes, tagsRes]`.
Dans le mapping enigma : `heritage_id: (e.heritage_id ...) ?? null,` → `theme: (e.theme as string | null) ?? null,`.
Remplacer `if (factionsRes.data) setFactions(...)` par `if (themesRes.data) setThemes(themesRes.data as Theme[])`.

- [ ] **Step 3 : Filtre liste**

Dans `filtered` (l.131-142), remplacer la condition heritage par :
```ts
      if (filterTheme !== 'all' && e.theme !== filterTheme) return false
```
(et mettre à jour le tableau de deps du `useMemo` : `filterHeritage` → `filterTheme`).

- [ ] **Step 4 : Form édition**

Dans `startEdit` (l.174-189), remplacer `heritage_id: enigma.heritage_id,` par `theme: enigma.theme,`.
Dans `handleSaveForm` payload (l.227-241), remplacer `heritage_id: editForm.heritage_id || null,` par `theme: editForm.theme || null,`.
Dans `handleBulkSave` (l.284-298), remplacer `heritage_id: e.heritage_id,` par `theme: e.theme,`.
Remplacer le `<label>` « Heritage » du formulaire (l.359-371) par :
```tsx
            <label className="settings-global-field">
              <span>Thème</span>
              <select
                value={editForm.theme || ''}
                onChange={e => setEditForm(prev => ({ ...prev, theme: e.target.value || null }))}
                className="settings-input"
              >
                <option value="">Aucun (universel)</option>
                {themes.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
```

- [ ] **Step 5 : Filtre + colonne tableau**

Remplacer le `<select>` de filtre heritage (l.556-565) par :
```tsx
        <select
          value={filterTheme}
          onChange={e => { setFilterTheme(e.target.value); setPage(1) }}
          className="settings-input"
        >
          <option value="all">Tous thèmes</option>
          {themes.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
```
Dans le rendu des lignes (l.595-613), remplacer le calcul `factionName` par :
```tsx
                const themeName = e.theme
                  ? themes.find(t => t.id === e.theme)?.label ?? '-'
                  : 'Universel'
```
et la cellule `<td>{factionName}</td>` → `<td style={{ fontSize: 11 }}>{themeName}</td>`,
l'en-tête `<th>Heritage</th>` → `<th>Thème</th>`.

- [ ] **Step 6 : Build**

Run: `pnpm --filter hub build`
Expected: build OK, zéro référence résiduelle à `heritage_id` / `factions` / `filterHeritage` dans `Enigmas.tsx`.

- [ ] **Step 7 : Commit**

```bash
git add apps/hub/src/components/Enigmas.tsx
git commit -m "feat(hub): editeur d'enigmes par Theme (retrait du menu faction)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : Hub `Fragments.tsx` — menu « Thème » (pioche du motif)

**Files:**
- Modify: `apps/hub/src/components/Fragments.tsx`

- [ ] **Step 1 : Type + état**

Dans l'interface `Fragment` (l.12-23), ajouter `theme: string | null` après `collection`.
Ajouter une interface :
```ts
interface ThemeOption { id: string; label: string }
```
Ajouter un state à côté de `factions` (l.49) :
```ts
  const [themes, setThemes] = useState<ThemeOption[]>([])
```

- [ ] **Step 2 : Fetch**

Dans `fetchFragments` (l.83-90), ajouter à `Promise.all` :
```ts
        supabase.from('enigma_themes').select('id, label').order('sort_order'),
```
Ajouter `themesRes` à la destructuration et, après `if (factionsRes.data) ...` :
```ts
      if (themesRes.data) setThemes(themesRes.data as ThemeOption[])
```
Dans le `map` qui construit `result` (l.114-125), s'assurer que `theme` est bien repris
(`...f` le porte déjà puisque le `select('*')` le ramène — vérifier le type du cast `frags`,
ajouter `theme: string | null` à l'inline type des `frags`).

- [ ] **Step 3 : Save**

Dans `handleSave` (l.209-218), ajouter au payload `update` :
```ts
          theme: f.theme || null,
```

- [ ] **Step 4 : UI menu Thème**

Juste après le bloc « Collection (héritage) » (l.543-558), ajouter :
```tsx
            {/* Thème — pool de pioche des énigmes du motif */}
            <div className="faction-bonus-row">
              <label className="faction-bonus-input">
                <span>Thème (pioche énigmes)</span>
                <select
                  value={frag.theme ?? ''}
                  onChange={e => updateFragment(frag.id, 'theme', e.target.value || null)}
                  className="fragment-select"
                >
                  <option value="">Aucun</option>
                  {themes.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>
```
(`updateFragment` accepte déjà `string | null` — voir sa signature l.174.)

- [ ] **Step 5 : Build**

Run: `pnpm --filter hub build`
Expected: build OK.

- [ ] **Step 6 : Commit**

```bash
git add apps/hub/src/components/Fragments.tsx
git commit -m "feat(hub): menu Theme sur les fragments (pool de pioche du motif)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7 : Vérification de bout en bout + push

- [ ] **Step 1 : Build complet des deux apps**

Run: `pnpm --filter explore-web build && pnpm --filter hub build`
Expected: les deux builds passent.

- [ ] **Step 2 : Smoke test fonctionnel (sur la prod alpha)**

Vérifier manuellement :
- Hub → Énigmes : le menu « Thème » liste les thèmes ; créer/éditer une énigme avec thème = « Grèce Antique » persiste.
- Hub → Fragments : assigner un thème à un motif persiste.
- App → quotidienne : une énigme à thème affiche le macaron (label + couleur) ; une énigme sans thème n'affiche pas de macaron.
- App → motif possédé avec thème : l'énigme du motif se charge (`get_fragment_enigma`) et `hasEnigma` s'allume bien dans le sélecteur d'énigmes.

- [ ] **Step 3 : Confirmer l'absence de régression `heritage_id`**

Run: `grep -rn "heritage_id\|heritageId" apps/ supabase/migrations/ | grep -iv "faction\|player_profile\|titles"`
Expected: plus aucune référence aux énigmes (les seules restantes acceptables concernent factions/titres/profil, sans rapport).

- [ ] **Step 4 : Push du lot**

Run: `git push origin main`
Expected: le lot complet (specs + 3 migrations + 3 fichiers front) est sur le remote.

- [ ] **Step 5 : Mémoire Citadelle (si MCP Obsidian reconnecté)**

Logger la décision dans la Bible Game Design / Décisions Game Design : « pioche énigmes = par Thème (enigma_themes), lien faction supprimé, macaron de thème ». (Bloqué tant que le MCP Obsidian est KO — flag à Uriel.)

---

## Notes de séquencement

- **Tasks 1→3 strictement ordonnées** (schéma → RPC → drop). Ne jamais droper `heritage_id` avant que les 3 RPC soient sur `theme` (sinon runtime cassé).
- **Tasks 4→6 indépendantes** entre elles (3 fichiers distincts), mais doivent venir **après** la Task 2 (les RPC retournent `theme`). La Task 4 dépend de la Task 1 (table `enigma_themes` à fetch).
- **Livrable B** (100 énigmes grecques) = plan séparé, après ce plan, sur feu vert d'Uriel.
