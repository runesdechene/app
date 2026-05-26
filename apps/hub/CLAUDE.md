# hub — Back-office admin

> Port dev 3001. Prod : hub.runesdechene.com (Netlify).
> Accès admin uniquement (`users.role = 'admin'`).

## Mémoire projet

Conventions, gotchas, décisions, préférences, architecture :
**`~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`**

4-Layer Query Rule et règles Graphify : voir `CLAUDE.md` racine monorepo.

## Spécificités cette app

- React 18 + Vite 5 + TypeScript strict
- React Router DOM
- CSS global (thème parchemin)
- **Netlify Functions** pour Shopify (sync, webhooks, proxy) dans `netlify/functions/`

## Commandes

```bash
pnpm --filter hub dev     # port 3001
pnpm --filter hub build
# Deploy — ⚠️ inclure --functions :
cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build
```

## Règles Hub spécifiques

- **Pattern SaveBar** — toutes les pages utilisent `<SaveBar>`. Pas d'auto-save (sauf `AssignFragments`).
- **Après chaque save** : refetch serveur pour garantir la synchro.
- **Deep copy** pour comparaison : `JSON.parse(JSON.stringify(data))`.
- **try/finally** autour des fetch — éviter les "Chargement…" infinis.
- **Classes CSS pubs** : préfixe `pub-*` (PAS `ads-*`, bloqué par ad blockers).

## Auth Hub — fetchRole

Toujours requêter par **email** (pas par id), voir Citadelle `DEV/Architecture/Auth et utilisateurs.md`.

## Vues de monitoring V0.7 phase 5

`Divers.tsx` héberge la section **Bascules récentes** (V0.7 phase 5, 5 mai 2026) :
listing des `place_taken_remote` des 30 derniers jours pour suivre l'usage de
**La Cour** (influence à distance) et détecter d'éventuels abus.

## Boucle récompense UGC (Brique 1, mai 2026)

> Spec : `docs/superpowers/specs/2026-05-26-ugc-mouvement-model-design.md` · Plan : `docs/superpowers/plans/2026-05-26-ugc-brique1-boucle-recompense.md` (mig 175)

La modération (`Photos.tsx` / `Reviews.tsx` → `moderate_submission` / `moderate_review`)
crédite des **Couronnes** + incrémente `users.contributions_count` **à la 1re validation**
(idempotent via `rewarded_at` — re-valider un archivé ne re-paie pas). `create_user_from_submission`
crédite un **bonus de bienvenue** (comptes neufs). Un **bonus 1re contribution** s'ajoute pour
tout compte (`contributions_count = 0`). La **Gloire n'est jamais touchée** (anti-triche, mig 024).

À la validation, une notif `contribution_approved` est insérée → trigger `email_on_notification`
→ edge function **`send-email`** (Resend) qui envoie l'email d'acceptation (+ push existant en bonus).
Montants tunables dans `app_settings` : `ugc_welcome_crowns` (20), `ugc_reward_crowns` (10),
`ugc_first_contribution_crowns` (30). Secrets email aussi dans `app_settings`
(`resend_api_key`, `email_trigger_secret`, `edge_function_send_email_url`, `email_from`).
Les écrans de fin des formulaires publics affichent les Couronnes via la RPC `get_ugc_reward_config`.

**Brique 1bis-A (mig 176, 2026-05-26)** : la récompense devient **MANUELLE** à la validation —
`moderate_submission` / `moderate_review` prennent un param `p_crowns` (le hub `Photos.tsx`/`Reviews.tsx`
a un champ Couronnes, défaut 10) ; le crédit auto fixe (`ugc_reward_crowns` + bonus 1re contribution)
est **abandonné** (clés `app_settings` dépréciées). Le bonus de **bienvenue** reste auto. Idempotence
conservée (`rewarded_at`). **Curation par photo** : `hub_submission_images` gagne `status`
(pending/approved/archived) + `size` (`'none'` = aucun produit porté) + `product_worn` (tagué au hub),
via RPC `set_submission_image_status` / `set_submission_image_product`. Envoi : `+ departement`,
`+ quest_ref` (pré-câblage quête, système Phase 2), `+ reward_crowns`. Le **studio public** de
soumission (wizard guidé) = Brique 1bis-B (à venir).
