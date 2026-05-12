# Bootstrap — Reprendre le repo sur une nouvelle machine

> Pour XO (Claude Code) : si tu lis ce fichier au premier lancement sur une machine fraîche,
> exécute la séquence ci-dessous AVANT toute autre action. Elle restaure les artefacts
> non versionnés (Graphify, hooks Git, dépendances) qui sont nécessaires au workflow.

## 1. Pré-requis machine

Vérifier (et installer si manquant) :
- Node.js ≥ 20 + `pnpm` (corepack ou install global)
- Python 3.10+ (pour les scripts Graphify)
- `graphify` CLI (`pip install graphify` ou équivalent — voir `scripts/graphify-sql.py` pour la dépendance)
- Supabase CLI (optionnel, pour appliquer des migrations en local depuis la branche : `npm i -g supabase` ou `pnpm dlx supabase`)
- Netlify CLI (optionnel, pour deploy : `npm i -g netlify-cli`)

## 2. Variables d'environnement (.env)

Le fichier `.env` racine du monorepo contient les `VITE_*` (Supabase URL/anon key, VAPID public, etc.).
Il est **gitignored**. Uriel l'a sauvegardé à part — le copier à la racine du repo cloné :

```
cp <chemin sauvegarde>/.env .
```

Sans ce fichier, `pnpm dev` lance mais aucune RPC ne fonctionne.

## 3. Dépendances + artefacts

```bash
# Dépendances JS
pnpm install

# Hooks Git Graphify (regen automatique du graph.json à chaque commit)
graphify hook install

# Premier rebuild manuel du graph SQL (172+ nodes RPC + tables)
python3 scripts/graphify-sql.py

# Premier rebuild manuel du graph code (AST TS/TSX)
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

Vérifier que `graphify-out/graph.json` existe ensuite — c'est le check 2 du HARD GATE de XO
(cf. `~/citadelle/CLAUDE.md`).

## 4. Lancement dev

```bash
cd apps/explore-web
pnpm dev   # port 3000, ouvre http://localhost:3000
```

Pour les autres apps :
- `cd apps/hub && pnpm dev` (back-office)
- `cd apps/seo-pages && pnpm dev` (Node.js, pages SEO)

## 5. Pour XO spécifiquement (Claude Code)

Au démarrage de la session sur cette machine, le HARD GATE du `CLAUDE.md` racine s'exécute :

1. **Check 1** : `hostname` → lookup dans `_system/machines.md` du vault Citadelle pour trouver
   le chemin du repo. Si la machine n'est pas listée, demander à Uriel de l'ajouter.
2. **Check 1.5** : lire `<repo>/CLAUDE.md` + `apps/<app>/CLAUDE.md` + `docs/db/xo-discipline.md`.
3. **Check 2** : vérifier que `graphify-out/graph.json` existe. Si absent, exécuter la séquence §3.
4. **Check 3** : routing par sujet (cf. CLAUDE.md vault).
5. **Check 4** : pour toute opération DB, lire `docs/db/gotchas.md` avant d'écrire du SQL.

## 6. Deploy à distance (sans `netlify link`)

Une machine fraîche ne peut pas faire `netlify deploy` sans projet linké
localement — `netlify link` est interactif et bloque le XO. Workaround :
deploy direct avec `--site <SITE_ID>`, listés ci-dessous.

**Pré-requis** : `netlify` CLI installé + connecté (`netlify status` doit
montrer "Uriel Lahoussaye"). L'auth est stockée dans `%APPDATA%\netlify\Config\config.json`
sur Windows et survit aux redémarrages.

### SITE_IDs Netlify

| Site Netlify | SITE_ID | Domaine prod |
|---|---|---|
| `runesdechene` (explore-web) | `1b29da09-c7af-44bf-9c31-465bfaae9d74` | `app.runesdechene.com` (+ alias `carte.runesdechene.com`) |
| `hub-runesdechene` | `d1cac03c-19a1-4b92-be72-fa3805428cd1` | `hub.runesdechene.com` |
| `rdc-seo-pages` | `5a5b9cb9-d330-41d7-a037-6bd65ac67eb9` | `rdc-seo-pages.netlify.app` (sert `/lieu/*` via rewrite) |

### Commandes deploy

```bash
# explore-web (app publique) — PAS de --functions
cd apps/explore-web && pnpm build
netlify deploy --prod \
  --site 1b29da09-c7af-44bf-9c31-465bfaae9d74 \
  --dir "$PWD/dist" --no-build

# hub (back-office) — TOUJOURS --functions
cd apps/hub && pnpm build
netlify deploy --prod \
  --site d1cac03c-19a1-4b92-be72-fa3805428cd1 \
  --dir "$PWD/dist" \
  --functions "$PWD/netlify/functions" --no-build
```

### Après chaque deploy explore-web

Bump la version en DB pour que les users sur ancien bundle voient
l'`UpdateBanner` et puissent migrer :

```bash
node scripts/sync-app-version.mjs
```

Lit le `# X.Y.Z` en tête de `apps/explore-web/CHANGELOG.md` et upsert
`app_settings.app.latest_version`. Requiert `SUPABASE_SERVICE_ROLE_KEY` dans le `.env` racine.

### Vérif post-deploy

```bash
# Le nouveau SW est-il bien en prod ?
curl -s https://app.runesdechene.com/sw.js | grep -oE "matchPrecache|KILL_SWITCH"
# La DB a-t-elle la bonne version ?
curl -s "$VITE_SUPABASE_URL/rest/v1/app_settings?key=eq.app.latest_version&select=value" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

### Lister tous les sites accessibles (rappel d'identité)

```bash
netlify sites:list --json | python -c "import json,sys; \
  [print(f\"{s['name']:<30} {s['site_id']}  {s.get('custom_domain','')}\") \
   for s in json.load(sys.stdin)]"
```

## 7. Production / Migrations en attente

État au 11/05/2026 (V0.8.13 en prod) :
- Mig SQL : 165 (era_indefinie), 166 (plant_flag_no_reaffirm_bonus), 167 (xp_delete_triggers
  dynamic + no reaffirm history) sont toutes appliquées en prod ET dans le repo
- Frontend déployé sur https://app.runesdechene.com
- Aucune mig orpheline locale

## 8. Si quelque chose casse en prod

Cycle de rollback éprouvé :
```bash
git revert HEAD --no-edit
git push
cd apps/explore-web
pnpm build
netlify deploy --prod --dir "$PWD/dist" --no-build
```

Note pour XO : **JAMAIS deploy sans test local** (`pnpm dev` + click flow user). Build OK ≠ runtime OK.
Cf. `~/.claude/projects/.../memory/feedback_test_local_avant_deploy.md`.
