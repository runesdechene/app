# Mission V0.5 — De la Conquête à l'Influence

Tu dois implémenter la V0.5 de l'application Runes de Chêne. C'est une refonte majeure du gameplay : on remplace le système de claim/fortification par un système d'influence multi-Héritage, on ajoute des fiches de lieu collaboratives, une énigme quotidienne, et on restructure les ressources (Gloire = Exploration + Érudition).

## Documents de référence

Lis ces deux fichiers AVANT de commencer quoi que ce soit :

1. **La spec** : `docs/superpowers/specs/2026-04-06-v05-influence-system-spec.md`
2. **Le plan d'implémentation** : `docs/superpowers/plans/2026-04-06-v05-influence-system.md`

Le plan contient 31 tasks réparties en 6 phases, avec le SQL complet, les fichiers exacts à toucher, et les commandes de vérification.

## Règles critiques

- **La DB est en production (live).** Chaque migration SQL doit être additive d'abord. On ne casse jamais l'existant. Backup obligatoire avant la Phase 6.
- **Ne jamais improviser une RPC.** Toujours lire l'ancienne version dans `.archives/migrations/` avant de la modifier.
- **Conventions** : pnpm, TypeScript strict, pas de `any`, conventional commits, CSS par composant, pattern SaveBar dans le Hub.
- **Lire les CLAUDE.md** de chaque app (`apps/explore-web/CLAUDE.md`, `apps/hub/CLAUDE.md`) et les fichiers `.wolf/` pour comprendre la structure.
- **Archiver chaque migration** : tout fichier SQL créé dans `supabase/migrations/` doit aussi être copié dans `.archives/migrations/`.

## Ordre d'exécution

Exécute phase par phase. Ne passe pas à la phase suivante sans que la précédente soit stable.

| Phase | Tasks | Quoi |
|-------|-------|------|
| 1 | 1-6 | Nouvelles tables + colonnes SQL (additif pur, zéro risque) |
| 2 | 7-14 | Nouvelles RPCs (influence, énigme, contributions, profil) |
| 3 | 15-19 | Frontend — InfluenceButton, drapeaux, territoires, profil |
| 4 | 20-23 | Frontend — Fiches collaboratives + énigme quotidienne |
| 5 | 24-27 | Hub — Gestion énigmes, settings, dashboard |
| 6 | 28-31 | Migration données + cleanup ancien système + docs |

## Ce que tu ne dois PAS faire

- Ne supprime aucun fichier sans demander
- Ne touche pas aux RPCs existantes (claim_place, fortify_place) avant la Phase 6
- Ne déploie rien sur Netlify sans mon accord
- N'applique pas les migrations SQL sur Supabase automatiquement — écris les fichiers, je les appliquerai moi-même

## Checkpoint

Après chaque phase terminée, fais-moi un résumé de ce qui a été fait et demande le go pour la phase suivante.
