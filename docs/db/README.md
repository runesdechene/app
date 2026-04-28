# `docs/db/` — Référence BDD

> Source de vérité pour les conventions, gotchas et architecture BDD.
> Migré depuis Obsidian (`📱 L'application (La Carte)/🛠️ DEV/`) le 28 avril 2026 dans le cadre du cleanup post-Graphify-SQL.

## Contenu

- [`gotchas.md`](./gotchas.md) — Pièges BDD : API Supabase JS, schema, RPCs, triggers, storage. À relire **avant** d'écrire une migration ou une RPC.
- [`auth.md`](./auth.md) — Modèle auth + users (deux tables, lien par email, rôles, mismatch `userData.id ≠ auth.uid()`, RLS silent-deny).
- [`storage.md`](./storage.md) — Bucket unique `place-images`, convention de paths, specs WebP, modèle JSONB.
- [`migrations-workflow.md`](./migrations-workflow.md) — Workflow CLI : appliquer, repair, lire avant réécrire, DB dev = prod alpha.

## Pour tout le reste

- **Schema actuel** : `supabase/migrations/001_baseline_2026-04-22.sql`
- **Décisions BDD individuelles** : commentaire en tête de chaque migration (`-- WHY : ...`)
- **Graphe DB indexé** : `graphify-out/graph.json` (104 RPCs + 55 tables, regen via `python3 scripts/graphify-sql.py`)
