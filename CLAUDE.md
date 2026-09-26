# Runes de Chêne — monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify
> L'état du projet, les décisions et la façon de travailler avec Uriel vivent dans le vault
> **Mon Cerveau** : lire le Claude.MD du vault, le '\_État.md' associé à ce projet (Runes de Chêne) et '\_Socle'. Ici, le code seulement.

## Où sont les choses

| Quoi                                                     | Où                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| App publique V1 (`app.runesdechene.com`)                 | `apps/explore-web/`                                             |
| Back-office (`hub.runesdechene.com`)                     | `apps/hub/`                                                     |
| Pages SEO (`/lieu/*`)                                    | `apps/seo-pages/`                                               |
| Base, migrations, RPC, edge functions                    | `supabase/`                                                     |
| Conception V2 — **fait foi**, points ouverts en bas      | `docs/superpowers/specs/2026-08-18-app-v2-design.md`            |
| Pièges DB, auth, storage, workflow migrations, dette SQL | `docs/db/`                                                      |
| Chantiers différés                                       | `docs/tech-backlog.md`                                          |
| Pièges payés en prod, chargés selon les fichiers touchés | `.claude/rules/` — lire `deploiement.md` avant tout déploiement |

Chaque app a son `CLAUDE.md` (commandes, stack, spécificités).

## Démarrage

1. `graphify-out/graph.json` absent → mauvais dépôt ou machine fraîche : **stop, demander**.
2. `git fetch` ; en retard → `git pull`, puis rebuild Graphify (le hook ne tourne pas sur un pull).
3. Question d'architecture → `graphify-out/GRAPH_REPORT.md` d'abord.

## Chercher avant de lire

1. Lib externe (React, Supabase, MapLibre…) → **Context7**
2. Code local, RPC, table → **Graphify** (`graphify-out/graph.json`)
3. Fichier brut en dernier, lu partiellement.

Un nom de colonne ou une signature de RPC ne se devine jamais : graph ou `information_schema`.

Graphify se reconstruit seul au commit (hook `post-commit`, + `scripts/graphify-sql.py` si
`supabase/migrations/` bouge). À la main :

- code : `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
- SQL : `python3 scripts/graphify-sql.py`

## Règles

- **pnpm** uniquement ; `npx` / `pnpm dlx` seulement pour `supabase`.
- **TS strict** : pas de `any`, `@ts-ignore`, `as unknown as`.
- **Conventional Commits.**
- **Migrations** numérotées, canal unique `npx supabase db push --linked` (`pnpm dlx` si npx casse).
  Je les applique moi-même, puis je vérifie en prod. En tête : `-- WHY:`. Tout `CREATE OR REPLACE`
  part de la définition **live** copiée entière. DROP en prod : vérifié à la main, jamais sur un
  rapport d'agent. Détail : `docs/db/migrations-workflow.md`.
- **Architecture existante d'abord** : helpers (`lib/`, `types/`), RPC et composants en place avant
  d'en créer. Source canonique, jamais une approximation qui « ressemble ».
- **Front** : composant rangé dans son sous-dossier dès la création ; > 700 lignes → découper ;
  sans état React → `lib/`, avec → `hooks/`. Pas de `console.log`.
- **Code mort croisé = supprimé dans le même commit.** Une rustine signale une cause racine.
- **Netlify manuel**, jamais d'auto-deploy Git.
- Pas de « bonne nuit » sans avoir lu l'heure.

## Livrer

- Front modifié → `pnpm dev` et le parcours testé dans le navigateur, puis `pnpm build` OK.
- Commit à chaque étape qui marche ; push par lots, **toujours en fin de session**.
- Fin de session : une décision → `_État.md` du vault ; un piège → `.claude/rules/`. Rien d'autre.

## Nouvelle machine

`.env` racine (gitignoré, sauvegardé à part) → `pnpm install` → `graphify hook install` →
les deux rebuilds Graphify ci-dessus.

## Repo voisin — thème Shopify

`../shopify (Runes de Chêne)/`, repo séparé (pas de fusion). Il consomme des RPC anon d'ici :
`get_community_photos_by_product` (mur « Ils nous portent ») et `get_fragment_unlocks_by_product`
(bloc app-unlock). **Les modifier casse une section du thème** → vérifier dans ses `sections/`.
Le Hub pousse avis et photos vers la boutique. Graphify n'indexe pas le Liquid.
