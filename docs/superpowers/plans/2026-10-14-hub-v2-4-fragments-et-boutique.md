# Hub V2 — plan 4 : Fragments et boutique

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** les quatre écrans du domaine « Fragments et boutique » du Hub V2 — Fragments (Shopify et scans, correspondance Shopify, achats à associer), Photos et avis, Synchro Shopify, Écoutes audio — plus l'association d'un Fragment à la main depuis la fiche d'un compte, le déménagement des fonctions Netlify dans `apps/hub-v2` et les deux lignes de « La santé » qui manquaient (Synchro Shopify, fiches publiques).

**Architecture:** une zone `apps/hub-v2/src/features/boutique/` (api, hooks, lib, components) sur les briques des plans 1-3 (EnTeteDePage, Tiroir, Bloc, TitreDeSection, Tuile, Balise, ChoixSegmente, ChampDeRecherche, Pages, `shared/lib/maplibre.ts`, `dates`, `quand`, `texte.pluriel`). Shopify ne se joint que par les fonctions Netlify, copiées dans `apps/hub-v2/netlify/functions/` (l'ancien Hub garde les siennes jusqu'à la bascule) et appelées par une brique `shared/lib/fonctions.ts` qui joint le jeton de session. Une seule migration (520) : la garde des lectures de photos, les lectures et écritures du Hub qui n'ont pas de fonction aujourd'hui, et le droit de l'équipe d'effacer une photo de son bucket.

**Tech Stack:** celle des plans 1-3 + `jszip` 3.10.1 (archive des photos, celle de l'ancien Hub) + `@mediapipe/tasks-vision` 1.1.0 (empreintes du scan, même version que `apps/web-v2`), chargé à la demande.

**Spec:** `docs/superpowers/specs/2026-10-14-hub-v2-design.md` — §3 (fonctions Netlify), §5 (menu « Fragments et boutique »), §9 (santé : Synchro Shopify, fiches publiques ; « achats à associer à la main »), §11 (Fragments : liste + fiche en tiroir ; Photos et avis : file à deux volets, maquette 596:1319 ; Écoutes audio : tableau de bord ; Synchro Shopify : réglages ; Comptes : « ses Fragments (+ associer à la main) »), §12.5 (les fonctions déménagent ; le webhook n'est repointé qu'à la bascule, plan 5), §13.4.

## Global Constraints

- Tout ce que disent les plans 1, 2 et 3 (Global Constraints) vaut ici : worktree **hors du dépôt** (`C:\Users\uriel\Desktop\DEVs\hub-v2-boutique`, branche `feat/hub-v2-boutique` empilée sur `feat/hub-v2-jeu`), casse exacte du chemin ; TS strict sans `any`, `@ts-ignore`, `as unknown as` ; jetons seulement ; en-têtes QUOI/POURQUOI ; README par dossier ; composant → hook → api ; tout état navigable est une URL ; animations par les jetons, `prefers-reduced-motion` ; pas de `console.log` ; pas de `window.confirm` (confirmation en ligne : « … ? » Confirmer / Annuler) ; ESLint `max-lines` 400 ; Conventional Commits + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Le tiroir garde l'état de la liste** (règle du plan 2) : lien de ligne `{ pathname: id, search: location.search }`, `retour` = liste + `location.search`.
- Migration **520** (une seule). Écrite, vérifiée dans une transaction annulée, **jamais appliquée par l'exécutant** : le contrôleur la fait appliquer avec l'accord d'Uriel (`npx supabase db push --linked` après `--dry-run`), puis régénère les types.
- Fonctions du Hub : `SECURITY DEFINER`, `SET search_path TO 'public'`, `IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;` en premier, `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated;`. Tout `CREATE OR REPLACE` d'une fonction existante part de sa définition **live** (`pg_get_functiondef`), copiée entière.
- **Ne pas toucher** aux RPC anonymes lues par le thème Shopify (`../shopify (Runes de Chêne)/sections/`) : `get_community_photos_by_product`, `get_fragment_unlocks_by_tag` (le `CLAUDE.md` racine l'appelle à tort `…_by_product` : vérifié dans `rdc_fragment-app.liquid` le 14/10), `get_landing_stats`. Leur signature et leur corps ne bougent pas ; les données qu'elles lisent (`shopify_unlocks`, photos publiées) changent par les écrans, comme aujourd'hui.
- **Fonctions Netlify** : copiées, l'ancien `apps/hub/netlify/functions/` n'est pas modifié ; `shopify-create-customer` ne déménage pas (spec §3). Les secrets vivent dans les variables du site Netlify, jamais dans le client ni dans le dépôt ; le `.env` racine n'est **jamais** importé dans Netlify. Déploiement à la main, jamais d'auto-deploy Git. **Aucun webhook ne change** : le webhook Shopify `orders/paid` reste sur `hub.runesdechene.com` jusqu'au plan 5 ; ne jamais envoyer de requête à l'ancien webhook.
- `hub.runesdechene.com` (ancien Hub) doit marcher pendant et après ce plan : aucun fichier de `apps/hub/` ne change ; les fonctions SQL qu'il appelle gardent leur signature (la 520 ajoute une garde à quatre lectures qu'il appelle en admin).
- Vocabulaire : « Fragment », « Porteur », « client validé » (jamais « client relié »), « Compagnie » (jamais « faction »), « contribution » (une soumission de photos), « étiquette » (tag de photo ou de produit Shopify), « correspondance » (`shopify_unlocks`).
- Un enregistrement réussi rafraîchit ce qu'il touche (TanStack Query) ; une erreur s'affiche sous son bloc avec le message reçu (base ou fonction) ; jamais d'écran blanc.

## Décisions prises en écrivant le plan

- **R1** — Lectures directes des tables publiques (`title_fragments`, `app_settings`, `hub_photo_tags` par `get_photo_tags`) ; écriture directe seulement sur `shopify_unlocks` (politique `equipe_ecrit`, `_is_admin()`, vérifiée le 14/10) ; partout ailleurs une fonction serveur.
- **R2** — Les fonctions déménagent à l'identique, **sauf trois trous de sécurité refermés dans les copies** (relevés le 14/10) : `shopify-batch-tags` et `shopify-sync-tags` n'ont aucune garde (n'importe qui peut réécrire les étiquettes d'un client Shopify) → `requireAdmin` comme `shopify-sync` ; `shopify-order-webhook` accepte une requête **sans** signature HMAC (seule une signature fausse est refusée) → signature obligatoire. Les copies sont hors du lint et du `tsc` du Hub V2 (code serveur repris tel quel).
- **R3** — Achats à associer : seules les lignes `no_match` se traitent à la main — « Associer un Fragment » (le Fragment va au compte, `source = 'shopify'`, la ligne passe `manual`) ou « Rien à débloquer » (la ligne passe `skipped`). Les lignes `pending` se règlent seules à l'inscription (`unlock_pending_fragments`) : montrées, sans action. Relevé du 14/10 : les 35 `no_match` sont des commandes de produits sans étiquette `fragment:` (folklore, yggdrasil…).
- **R4** — Une étiquette de correspondance est enregistrée rognée et en minuscules : le webhook compare les étiquettes produit en minuscules (les 12 existantes le sont).
- **R5** — Associer un Fragment depuis la fiche d'un compte passe par une fonction (deux écritures d'un coup, comme l'ancien Hub : `user_fragments` `manual` + une ligne `purchase_log` `manual`) ; « Retirer » efface la ligne `user_fragments`, sans journal, comme l'ancien Hub.
- **R6** — Le « compte du stand » (fonction `stand-create-account`) est repris, depuis l'écran Comptes ; la « mise en attente pour un e-mail sans compte » ne l'est pas (le compte du stand fait mieux ; les 33 lignes existantes restent réclamables à l'inscription).
- **R7** — Photos et avis : les quatre filtres de la spec et la recherche ; ne sont pas repris les filtres par rôle et par étiquette, la suppression d'une étiquette pour toutes les photos, la visionneuse plein écran (une photo s'ouvre en grand dans un onglet), l'affichage des Missions V1.
- **R8** — Supprimer une contribution nettoie chaque photo comme l'ancien « supprimer une photo » : la photo d'abord retirée de la fiche produit Shopify (si Shopify refuse, rien n'est supprimé), puis du bucket, puis de la base. Le bucket `community-photos` n'avait aucune politique d'effacement : l'ancien Hub croyait effacer et ne faisait rien.
- **R9** — Les quatre lectures de photos de l'ancien Hub (`get_photo_submissions`, `get_submission_images_batch`, `get_submission_tags_batch`, `get_photo_tags`) sont ouvertes à tout compte connecté sans garde (les e-mails des contributeurs lisibles par n'importe quel joueur) : elles reçoivent `_is_staff()`, comme les 16 écritures de la mig 513. Le Hub V2 lit par une fonction nouvelle, `hub_contributions` (sans la limite de 100 et avec les chiffres).
- **R10** — Synchro Shopify : la liaison compte-client (`shopify-sync`) et l'étiquette de provenance (`source:app` / `source:shopify` + `app-player`), sans étiquette de faction ni « aperçu croisé » (il montrait Gloire et Compagnie V1). La branche `account_source = 'both'` disparaît (aucun compte ne l'a, relevé du 14/10).
- **R11** — Fiches publiques : le workflow de la nuit note la fin de sa reconstruction dans `app_settings.fiches_publiques_le` (après le déploiement) ; la santé est orange au-delà de 36 h. Tant que le workflow modifié n'est pas sur `main`, la ligne dit « Jamais relevée ».
- **R12** — Écoutes audio au modèle « tableau de bord » : tuiles et lignes, sans les jauges de l'ancien écran ; une ligne porte le nom de l'Illustration quand l'inventaire Shopify l'a donné, son identifiant sinon.

## Review Focus

1. **Les fonctions Netlify absentes ou en panne** (en local elles ne tournent pas ; une fonction qui répond du HTML ou un 403) → un message lisible (« Les fonctions Netlify ne répondent pas (HTTP 404)… », « Forbidden — admin only »), jamais « Unexpected token '<' » ni un écran vide. (Test : Task 2, `lireReponse`.)
2. **Supprimer une contribution dont une photo est sur la fiche produit Shopify** → la photo est retirée de Shopify d'abord ; si Shopify refuse, la contribution reste entière et l'erreur s'affiche. (Test : Task 8, ordre des appels.)
3. **Une correspondance tapée « Fragment:Hoplite  »** → enregistrée `fragment:hoplite` ; un doublon dit « Cette correspondance existe déjà. ». (Test : Task 5.)
4. **Un achat `pending`** → aucune action proposée (« Attend son inscription ») ; un achat `no_match` sans compte → pas d'« Associer ». La base refuse aussi (« Cet achat n’attend pas d’association », « Aucun compte pour cet achat »). (Test : Task 5 et SQL Task 1.)
5. **L'inventaire Shopify qui tarde, refuse une portée ou revient vide** → les relevés des Écoutes disent « Lecture de l’inventaire… » ou la panne, jamais « 0 » pendant le chargement (le contresens constaté le 16/08) ; le tableau des écoutes s'affiche même si Shopify est en panne. (Test : Task 9.)

---

## Fichiers

```
supabase/migrations/520_hub_boutique.sql
.github/workflows/seo-nightly.yml                          (une étape à la fin)
CLAUDE.md                                                   (get_fragment_unlocks_by_tag)
apps/hub-v2/
  package.json (jszip, @mediapipe/tasks-vision) · netlify.toml · eslint.config.js · CLAUDE.md
  netlify/functions/  README.md + flyer-create-account · stand-create-account · shopify-order-webhook ·
                      shopify-proxy · shopify-health-check · shopify-article · shopify-sync ·
                      shopify-batch-tags · shopify-sync-tags · shopify-callback   (.ts)
  src/shared/lib/fonctions.ts (+test)
  src/shared/supabase/database.types.ts                     (signatures de la 520, à la main)
  src/app/router.tsx                                        (routes, ECRANS_FAITS)
  src/features/accueil/  api/sante.ts · hooks/useSanteBoutique.ts · components/{Sante, Attente, Ouverture}.tsx (+ Sante.test.tsx)
  src/features/communaute/
    api/fragmentsDuCompte.ts · hooks/useFragmentsDuCompte.ts
    components/{AssocierFragment.tsx, TiroirCompteDuStand.tsx} (+tests) · TiroirCompte.tsx · Comptes.tsx
  src/features/boutique/
    README.md
    api/        shopify.ts · fragments.ts · scan.ts · correspondance.ts · achats.ts · contributions.ts · ecoutes.ts · synchro.ts
    hooks/      useFragments.ts · useSynchroFragments.ts · useCorrespondance.ts · useAchats.ts · useContributions.ts · useEcoutes.ts · useSynchro.ts
    lib/        texteRiche.ts · motifs.ts · achats.ts · contribution.ts · archive.ts · ecoutes.ts · provenance.ts (+ tests) · empreintes.ts
    components/ OngletsFragments.tsx · Fragments.tsx · MotifsSansFragment.tsx · TiroirFragment.tsx · CarteDOrigine.tsx · ScanDuFragment.tsx
                Correspondance.tsx · Achats.tsx
                Photos.tsx · LectureContribution.tsx · PhotoDeContribution.tsx · ChoixDuProduit.tsx
                Ecoutes.tsx · Synchro.tsx
                Boutique.module.css · Photos.module.css (+ tests *.test.tsx)
```

---

### Task 1: Migration 520 — photos gardées, achats, association, comptes clients (écrite, vérifiée, **non appliquée**)

**Files:** Create `supabase/migrations/520_hub_boutique.sql` ; Modify `apps/hub-v2/src/shared/supabase/database.types.ts`.

**Interfaces — Produces:**
- `hub_contributions(p_statut text DEFAULT 'pending', p_recherche text DEFAULT NULL, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0) returns jsonb` → `{ total, compteurs: { a_valider, publiees, archivees, au_mur, plus_ancienne }, lignes: [Contribution] }` ; `p_statut` ∈ `pending, approved, archived, toutes` (sinon « Statut inconnu ») ; recherche sans joker (position) dans le nom et l'e-mail ; tri `created_at DESC, id` ; limite 1..100. Une ligne : `{ id, quand, statut, nom, email, instagram, role, compte, lieu, code_postal, departement, message, note_equipe, taille, produit, hauteur, epaules, note_experience, note_produits, diffusion, recompensee_le, images: [{ id, url, chemin, taille, produit_id, produit_handle, produit_titre, media, communaute, mur }], etiquettes: [{ id, nom }] }`.
- `hub_achats() returns jsonb` → `[{ id, quand, statut, email, commande, tag, fragment, compte: { id, nom } | null }]`, statuts `pending` et `no_match`, du plus récent au plus ancien.
- `hub_associer_achat(p_achat integer, p_fragment integer) returns void` ; `hub_classer_achat(p_achat integer) returns void`.
- `hub_associer_fragment(p_user text, p_fragment integer) returns void` ; `hub_retirer_fragment(p_user text, p_fragment integer) returns void`.
- `hub_comptes_clients() returns jsonb` → `[{ email, client, provenance }]` (comptes qui ont un `shopify_customer_id`).
- `get_photo_submissions`, `get_submission_images_batch`, `get_submission_tags_batch`, `get_photo_tags` : mêmes signatures et corps, garde `_is_staff()` en plus.
- Politique `equipe_retire_photos_communaute` sur `storage.objects` (DELETE, bucket `community-photos`, `_is_admin()`).

- [ ] **Step 1: Relever le live** (lecture seule) :

```bash
npx supabase db query --linked "select table_name, column_name from information_schema.columns where table_schema='public' and (table_name, column_name) in (('purchase_log','id'),('purchase_log','email'),('purchase_log','shopify_order_id'),('purchase_log','shopify_tag'),('purchase_log','unlock_type'),('purchase_log','unlock_ref_id'),('purchase_log','user_id'),('purchase_log','status'),('purchase_log','created_at'),('user_fragments','source'),('hub_photo_submissions','team_note'),('hub_photo_submissions','rating_products'),('hub_photo_submissions','rewarded_at'),('hub_submission_images','show_on_wall'),('hub_submission_images','shopify_media_id'),('hub_submission_images','storage_path'),('users','shopify_customer_id'),('users','account_source'),('users','display_name')) order by 1,2"
npx supabase db query --linked "select pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('get_photo_submissions','get_submission_images_batch','get_submission_tags_batch','get_photo_tags')"
npx supabase db query --linked "select pg_get_constraintdef(oid) from pg_constraint where conname in ('purchase_log_status_check','user_fragments_source_check','user_fragments_pkey')"
```

Attendu : les 19 couples ; les quatre définitions identiques à celles recopiées ci-dessous (relevées le 14/10) ; `status` ∈ `unlocked, pending, manual, skipped, no_match, no_tags` ; `source` ∈ `manual, shopify, achievement` ; clé `(user_id, fragment_id)`. Un écart → STOP.

- [ ] **Step 2: Écrire la migration :**

```sql
-- WHY: Hub V2, plan 4 (Fragments et boutique).
--      1. Les lectures de photos de l'ancien Hub (get_photo_submissions & co.) étaient ouvertes à tout
--         compte connecté, sans garde : n'importe quel joueur lisait l'e-mail des contributeurs. Garde
--         _is_staff(), comme les 16 écritures de la mig 513 ; corps repris du live.
--      2. Le Hub V2 lit les contributions par hub_contributions (les chiffres, sans la limite de 100).
--      3. « Achats à associer » (spec §9) : purchase_log n'a pas de politique UPDATE ; une ligne
--         no_match ne pouvait jamais quitter la file. hub_associer_achat / hub_classer_achat la règlent.
--      4. Associer un Fragment à la main en une écriture (user_fragments + purchase_log, comme l'ancien Hub).
--      5. La synchro de provenance lit les comptes clients sans passer par la vue users_admin.
--      6. Le bucket community-photos n'avait aucune politique d'effacement : l'ancien Hub croyait retirer
--         les fichiers et ne retirait rien.
-- SCHEMA CHECKED (14/10/2026, live) : voir le plan 4, Task 1 Step 1 ; _is_admin(), _is_staff(), _refus().

-- 1. Lectures de photos : réservées à l'équipe (corps live, garde ajoutée)
CREATE OR REPLACE FUNCTION public.get_photo_submissions(p_status text DEFAULT NULL::text)
 RETURNS SETOF hub_photo_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_status IS NULL THEN
    RETURN QUERY SELECT * FROM hub_photo_submissions ORDER BY created_at DESC LIMIT 100;
  ELSE
    RETURN QUERY SELECT * FROM hub_photo_submissions WHERE status = p_status ORDER BY created_at DESC LIMIT 100;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_photo_tags()
 RETURNS SETOF hub_photo_tags
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN QUERY SELECT * FROM hub_photo_tags ORDER BY name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_submission_images_batch(p_submission_ids uuid[])
 RETURNS SETOF hub_submission_images
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN QUERY SELECT * FROM hub_submission_images WHERE submission_id = ANY(p_submission_ids) ORDER BY sort_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_submission_tags_batch(p_submission_ids uuid[])
 RETURNS TABLE(submission_id uuid, tag_id uuid, tag_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_staff() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN QUERY
    SELECT pst.submission_id, t.id AS tag_id, t.name AS tag_name
    FROM hub_photo_submission_tags pst
    INNER JOIN hub_photo_tags t ON t.id = pst.tag_id
    WHERE pst.submission_id = ANY(p_submission_ids)
    ORDER BY t.name;
END;
$function$;
```

puis, chacune suivie de `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated;` :

- `hub_contributions` (plpgsql, `STABLE`) : garde ; `v_recherche := NULLIF(lower(btrim(p_recherche)), '')`, `v_limite := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 100)`, `v_decalage := GREATEST(COALESCE(p_decalage, 0), 0)` ; `IF p_statut IS NULL OR p_statut NOT IN ('pending','approved','archived','toutes') THEN PERFORM _refus('Statut inconnu', 'statut')` ; CTE `filtres` (statut, recherche par `position` dans `lower(submitter_name)` et `lower(submitter_email)`), CTE `page` (`ORDER BY created_at DESC, id LIMIT … OFFSET …`) ; `compteurs` : `a_valider` / `publiees` / `archivees` = nombre de contributions `pending` / `approved` / `archived`, `au_mur` = nombre de `hub_submission_images` avec `show_on_wall`, `plus_ancienne` = `min(created_at)` des `pending` ; chaque ligne selon l'interface (`quand` ← `created_at`, `statut` ← `status`, `nom` ← `submitter_name`, `email` ← `submitter_email`, `instagram` ← `submitter_instagram`, `role` ← `submitter_role`, `compte` ← `user_id`, `lieu` ← `location_name`, `code_postal` ← `location_zip`, `note_equipe` ← `team_note`, `taille` ← `product_size`, `produit` ← `product_worn`, `hauteur` ← `model_height_cm`, `epaules` ← `model_shoulder_width_cm`, `note_experience` ← `rating_experience`, `note_produits` ← `rating_products`, `diffusion` ← `consent_brand_usage`, `recompensee_le` ← `rewarded_at`) ; `images` triées `sort_order, created_at` (`url` ← `image_url`, `chemin` ← `storage_path`, `taille` ← `size`, `produit_id/handle/titre` ← `shopify_product_*`, `media` ← `shopify_media_id`, `communaute` ← `show_in_community`, `mur` ← `show_on_wall`) ; `etiquettes` triées par nom ; `'[]'::jsonb` quand vide.
- `hub_achats` (sql ou plpgsql, `STABLE`) : `purchase_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.status IN ('pending','no_match') ORDER BY a.created_at DESC, a.id DESC` ; `compte` = `NULL` sans compte, sinon `{ id, nom: COALESCE(u.display_name, u.first_name, 'Un Voyageur') }`.
- `hub_associer_achat` :

```sql
DECLARE v_achat purchase_log%ROWTYPE;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT * INTO v_achat FROM purchase_log WHERE id = p_achat FOR UPDATE;
  IF NOT FOUND THEN PERFORM _refus('Achat introuvable', 'achat'); END IF;
  IF v_achat.status <> 'no_match' THEN PERFORM _refus('Cet achat n’attend pas d’association', 'achat'); END IF;
  IF v_achat.user_id IS NULL THEN PERFORM _refus('Aucun compte pour cet achat', 'achat'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_fragment) THEN PERFORM _refus('Fragment inconnu', 'fragment'); END IF;
  INSERT INTO user_fragments (user_id, fragment_id, source) VALUES (v_achat.user_id, p_fragment, 'shopify')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;
  UPDATE purchase_log SET status = 'manual', unlock_type = 'fragment', unlock_ref_id = p_fragment WHERE id = p_achat;
END;
```

- `hub_classer_achat` : mêmes refus « Achat introuvable » et « Cet achat n’attend pas d’association » ; `UPDATE purchase_log SET status = 'skipped' WHERE id = p_achat`.
- `hub_associer_fragment` : refus « Compte introuvable » (absent de `users`) et « Fragment inconnu » ; `INSERT INTO user_fragments (user_id, fragment_id, source) VALUES (p_user, p_fragment, 'manual') ON CONFLICT (user_id, fragment_id) DO NOTHING;` puis `IF FOUND THEN INSERT INTO purchase_log (email, user_id, unlock_type, unlock_ref_id, status) SELECT u.email_address, u.id, 'fragment', p_fragment, 'manual' FROM users u WHERE u.id = p_user; END IF;` (rien en double si le compte l'a déjà).
- `hub_retirer_fragment` : `DELETE FROM user_fragments WHERE user_id = p_user AND fragment_id = p_fragment;` (aucun refus si absent).
- `hub_comptes_clients` (`STABLE`) : `jsonb_agg(jsonb_build_object('email', email_address, 'client', shopify_customer_id, 'provenance', account_source))` des `users` où `shopify_customer_id IS NOT NULL`, `'[]'` sinon.
- Le bucket :

```sql
CREATE POLICY equipe_retire_photos_communaute ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-photos' AND public._is_admin());
```

- [ ] **Step 3: Vérifier sans appliquer.** `npx supabase db push --dry-run --linked` doit lister **520** (avec 518-519 s'ils ne sont pas encore appliqués) ; ne PAS lancer `db push`. Puis, dans une transaction annulée, en se faisant passer pour un admin (`select id from users where role='admin' limit 1`) : `begin; <contenu de 520>; select set_config('request.jwt.claims', json_build_object('sub','<id admin>','role','authenticated')::text, true); <tests>; rollback;`. Tests : `hub_contributions('pending',null,5,0)->'compteurs'` (`a_valider` = `select count(*) from hub_photo_submissions where status='pending'`) ; `hub_contributions('x',null,5,0)` → « Statut inconnu » ; une recherche `'%'` → `total` 0 ; `jsonb_array_length(hub_achats())` ≈ 129 (94 `pending` + 35 `no_match` le 14/10) ; `hub_associer_achat(<un id pending>, <un fragment>)` → « Cet achat n’attend pas d’association » ; `hub_classer_achat(<un id no_match>)` puis la ligne est `skipped` ; `hub_associer_fragment(<id admin>, <fragment non possédé>)` deux fois → une ligne `user_fragments`, une seule ligne `purchase_log` `manual` ; puis avec les claims d'un compte non admin : `get_photo_submissions(null)` et `hub_achats()` → « Réservé à l’équipe ». Coller les sorties dans le rapport. Si le contrôle automatique refuse même la transaction annulée : le dire (BLOCKED partiel) et livrer le fichier relu.
- [ ] **Step 4: Types** : ajouter à la main les sept fonctions `hub_*` dans `database.types.ts` (section `Functions`, même forme que `hub_comptes`), en attendant la régénération par le contrôleur. Commit `feat(db): la boutique du Hub — photos gardées, achats, association à la main (mig 520, à appliquer)`.

---

### Task 2: Les fonctions Netlify déménagent ; la brique d'appel

**Files:** Create `apps/hub-v2/netlify/functions/*.ts` (10 copies) + `README.md`, `src/shared/lib/fonctions.ts` (+`fonctions.test.ts`) ; Modify `apps/hub-v2/netlify.toml`, `eslint.config.js`, `CLAUDE.md`, `src/shared/lib/README.md`.

**Interfaces — Produces:**
- `appelerFonction(nom: string, init?: { methode?: 'GET' | 'POST' | 'PUT' | 'DELETE'; corps?: unknown; parametres?: Record<string, string> }): Promise<Response>` — joint `Authorization: Bearer <jeton de session>` ; sans session : `throw new Error('Session expirée : reconnecte-toi.')`.
- `lireReponse<T>(r: Response): Promise<T>` — lit le texte d'abord ; pas du JSON → `Les fonctions Netlify ne répondent pas (HTTP {status}). En local elles ne tournent pas : tester sur le site de préparation.` ; un corps `{ error: string }` → `throw new Error(error)` ; sinon le corps.

- [ ] **Step 1: Copier.** Depuis la racine du worktree : `mkdir -p apps/hub-v2/netlify/functions` puis copier les dix fichiers de `apps/hub/netlify/functions/` **sauf** `shopify-create-customer.ts`. `git diff --no-index apps/hub/netlify/functions/shopify-proxy.ts apps/hub-v2/netlify/functions/shopify-proxy.ts` (et les autres) : aucune différence avant l'étape suivante.
- [ ] **Step 2: Refermer les trois trous dans les copies (R2).**
  - `shopify-batch-tags.ts` et `shopify-sync-tags.ts` : ajouter la fonction `requireAdmin` de `shopify-proxy.ts` (copiée telle quelle), `'Access-Control-Allow-Headers': 'Content-Type, Authorization'` dans la réponse `OPTIONS`, et juste après le refus des méthodes autres que POST :

```ts
  const auth = await requireAdmin(request)
  if ('error' in auth) return json({ error: auth.error }, auth.status)
```

  - `shopify-order-webhook.ts` : remplacer le bloc de vérification HMAC par :

```ts
  // La signature est obligatoire : Shopify l'envoie toujours ; une requête sans elle n'est pas de Shopify.
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256')
  if (!hmacHeader || !SHOPIFY_SECRET) {
    return json({ error: 'Missing HMAC signature' }, 401)
  }
  const hash = crypto.createHmac('sha256', SHOPIFY_SECRET).update(rawBody).digest('base64')
  if (hash !== hmacHeader) {
    return json({ error: 'Invalid HMAC signature' }, 401)
  }
```

  Rien d'autre ne change dans les copies (journaux et messages compris : code serveur repris tel quel).
- [ ] **Step 3: Configuration.** `netlify.toml` :

```toml
# QUOI     — le site Netlify du Hub V2 (préparation, puis hub.runesdechene.com à la bascule).
# POURQUOI — une appli d'une page : toute adresse sert index.html, le routeur fait le reste. Les
#            fonctions (Shopify, comptes du stand et du flyer) sont celles de l'ancien Hub, déménagées.
[build]
  publish = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["@supabase/supabase-js"]

[functions."shopify-sync"]
  timeout = 60

[functions."shopify-callback"]
  timeout = 15

[functions."shopify-proxy"]
  timeout = 15

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

  `eslint.config.js` : `ignores: ['dist', 'netlify', 'src/shared/supabase/database.types.ts']` (les fonctions sont hors de `tsconfig.include`, comme dans l'ancien Hub). `netlify/functions/README.md` : une ligne par fonction (qui l'appelle, garde : admin / publique / signature Shopify), les variables d'environnement lues (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP`, `FLYER_PROMO_CODE`) — sans aucune valeur — et « le webhook `orders/paid` de Shopify pointe encore vers l'ancien site ; il ne change qu'au plan 5 ». `CLAUDE.md` du Hub V2 : la commande de déploiement devient `cd apps/hub-v2 && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build --site=5d04dcdd-6374-4e8b-a0f4-fcef64a707f3`.
- [ ] **Step 4: Tests de la brique (rouges)** — `shared/lib/fonctions.test.ts`, `fetch` simulé par `vi.stubGlobal`, `supabase.auth.getSession` simulé :

```ts
import { vi } from 'vitest'
import { appelerFonction, lireReponse } from './fonctions'

const session = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { auth: { getSession: session } } }))

test('le jeton part avec l’appel, les paramètres dans l’adresse', async () => {
  session.mockResolvedValue({ data: { session: { access_token: 'jwt' } } })
  const f = vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('fetch', f)
  await appelerFonction('shopify-proxy', { methode: 'POST', corps: { a: 1 }, parametres: { endpoint: 'graphql.json' } })
  expect(f).toHaveBeenCalledWith('/.netlify/functions/shopify-proxy?endpoint=graphql.json',
    expect.objectContaining({ method: 'POST', body: '{"a":1}', headers: expect.objectContaining({ Authorization: 'Bearer jwt' }) }))
})
test('sans session : on le dit', async () => {
  session.mockResolvedValue({ data: { session: null } })
  await expect(appelerFonction('shopify-health-check')).rejects.toThrow('Session expirée : reconnecte-toi.')
})
test('du HTML au lieu de JSON : un message lisible', async () => {
  await expect(lireReponse(new Response('<!doctype html>', { status: 404 })))
    .rejects.toThrow('Les fonctions Netlify ne répondent pas (HTTP 404).')
})
test('une erreur de la fonction remonte telle quelle', async () => {
  await expect(lireReponse(new Response('{"error":"Forbidden — admin only"}', { status: 403 }))).rejects.toThrow('Forbidden — admin only')
})
test('un corps JSON est rendu', async () => {
  await expect(lireReponse<{ ok: boolean }>(new Response('{"ok":true}'))).resolves.toEqual({ ok: true })
})
```

- [ ] **Step 5: Code** de `fonctions.ts` selon l'interface (`fetch('/.netlify/functions/' + nom + recherche, { method, headers, body })`, `Content-Type: application/json` seulement avec un corps) ; une ligne au `shared/lib/README.md`. `cd apps/hub-v2 && pnpm test && pnpm lint && pnpm build`. Commit `feat(hub-v2): les fonctions Netlify déménagent (trois trous refermés dans les copies)`.
- [ ] **Step 6: En ligne — par le contrôleur, avec l'accord d'Uriel** (écrire des secrets sur un site est une écriture) :
  1. Comparer les **noms** de variables des deux sites, jamais leurs valeurs : `netlify env:list --site d1cac03c-19a1-4b92-be72-fa3805428cd1 --json | node -e "process.stdin.on('data',d=>console.log(Object.keys(JSON.parse(d)).join(' ')))"`, puis la même chose pour `5d04dcdd-6374-4e8b-a0f4-fcef64a707f3`.
  2. S'il en manque sur le site de préparation : `netlify env:clone --from d1cac03c-19a1-4b92-be72-fa3805428cd1 --to 5d04dcdd-6374-4e8b-a0f4-fcef64a707f3` (copie d'un site à l'autre, rien ne passe par un fichier local).
  3. `pnpm build`, puis la commande de déploiement du `CLAUDE.md` (avec `--functions`).
  4. Vérifier : `curl -s -o /dev/null -w "%{http_code}" https://rdc-hub-v2.netlify.app/.netlify/functions/shopify-health-check` → `401` ; `curl -s -o /dev/null -w "%{http_code}" -X POST -d '{"items":[]}' https://rdc-hub-v2.netlify.app/.netlify/functions/shopify-batch-tags` → `401` ; `curl -s -o /dev/null -w "%{http_code}" -X POST -d '{}' https://rdc-hub-v2.netlify.app/.netlify/functions/shopify-order-webhook` → `401`. **Ne jamais envoyer de requête au webhook de l'ancien site.** `https://hub.runesdechene.com/.netlify/functions/shopify-health-check` → toujours `401` (l'ancien n'a pas bougé).

---

### Task 3: Fragments — la liste, la synchro Shopify, les motifs sans Fragment

**Files:** `features/boutique/README.md`, `api/shopify.ts`, `api/fragments.ts`, `api/scan.ts`, `lib/texteRiche.ts` (+test), `lib/motifs.ts` (+test), `lib/empreintes.ts`, `hooks/useFragments.ts`, `hooks/useSynchroFragments.ts`, `components/OngletsFragments.tsx`, `components/Fragments.tsx` (+test), `components/MotifsSansFragment.tsx`, `components/Boutique.module.css`, `package.json` (`"@mediapipe/tasks-vision": "1.1.0"`), router.

**Interfaces:**
- Consumes : `appelerFonction`, `lireReponse` (Task 2) ; RPC existantes `synchroniser_fragments(p_illustrations jsonb) → integer`, `ajouter_fragment(p_nom text, p_collection text) → integer` (refus « Ce motif n'a pas de collection Shopify »), `scan_du_hub(p_modele text) → [{ id, illustrations, vues: [{ id, le, par }], scans7, scans30 }]`, `remplacer_empreintes_illustration(p_fragment integer, p_vecteurs jsonb, p_modele text) → integer`, `cultures_du_hub()` (toutes gardées, vérifié le 14/10).
- Produces — `api/shopify.ts` : `SHOP = 'runes-de-chene.myshopify.com'` ; `class AccesShopifyRefuse extends Error { readonly portee: string }` ; `class InventaireVide extends Error` ; `graphqlShopify<T>(requete: string): Promise<T>` (POST `shopify-proxy`, `parametres: { endpoint: 'graphql.json', shop: SHOP }` ; `errors` avec `ACCESS_DENIED` → `AccesShopifyRefuse` (portée extraite de « `xxx` access scope », sinon `read_metaobjects`) ; autre `errors[0].message` → `Error`) ; `type Illustration = { handle, nom, collection, resume, histoire, illustration_url, illustration_sombre_url, fond_url, audio_url, artiste, narrateur, heritage }` (tous `string`, `''` si vide) ; `lireIllustrations(): Promise<Illustration[]>` — **repris de `apps/hub/src/lib/shopifyIllustrations.ts` `fetchIllustrationsCompletes`** (type de métaobjet `illustrations` au pluriel, champs `image_pour_fond_clair`, `image_pour_fond_sombre`, `image_fond_de_fragment`, `fragment_audio`, `narrateur_audio`, `collection_d_heritage`, `son_histoire` ; refus « Plus de 100 Illustrations dans Shopify : la synchro ne lit que les 100 premières »). Le reste du fichier vient aux Tasks 8-10.
- `api/fragments.ts` : `type Fragment = { id: number; name: string; link_url: string | null; visible: boolean; shopify_handle: string | null; resume: string | null; histoire: string | null; illustration_url: string | null; illustration_sombre_url: string | null; audio_url: string | null; artiste: string | null; narrateur: string | null; heritage: string | null; synchronise_le: string | null; origine_lat: number | null; origine_lng: number | null; origine_nom: string | null; theme: string | null }` ; `lireFragments()` (`title_fragments`, ces colonnes, tri `name`) ; `synchroniserFragments(ills: Illustration[]): Promise<number>` ; `ajouterFragment(ill: Illustration): Promise<number>` (`ajouter_fragment(ill.nom, ill.collection)` puis `synchroniser_fragments([ill])`, rend l'id).
- `api/scan.ts` : `MODELE = 'mobilenet_v3_small'` ; `type ScanDUnFragment = { id: number; illustrations: number; vues: { id: number; le: string; par: string | null }[]; scans7: number; scans30: number }` ; `lireScans()`, `recalculerEmpreintes(f: Pick<Fragment, 'id' | 'illustration_url' | 'illustration_sombre_url'>): Promise<number>` (calcul par `lib/empreintes.ts` puis `remplacer_empreintes_illustration`), `retirerEmpreinte(id: number): Promise<void>`.
- `lib/empreintes.ts` : `calculerEmpreintes(urls: (string | null)[]): Promise<number[][]>` — **repris de `apps/hub/src/lib/empreintesScan.ts`** sans rien changer au calcul (256 px, 90 %, fonds `#ffffff` et `#161616`, zooms 1 et 1,5, arrondi 1e-4, modèle et wasm sur `https://app.runesdechene.com/modeles`), sauf `import('@mediapipe/tasks-vision')` **à la demande** dans `modele()` (le module n'est chargé qu'au premier calcul, et jamais par les tests).
- `lib/texteRiche.ts` : `texteRiche(valeur: string | null): string` (repris de l'ancien Hub). `lib/motifs.ts` : `estUnFragment(ill, fragments)`, `motifsSansFragment(ills, fragments)`.
- `hooks/useFragments.ts` : `useFragments()` (`['hub-fragments']`), `useScans()` (`['hub-scans']`), `useCultures()` (`['hub-cultures-fragments']`, `cultures_du_hub` réduit à `{ id, label, couleur }`), `useIllustrations()` (`['hub-illustrations']`, `retry: false`). `hooks/useSynchroFragments.ts` : `useSynchroFragments(): { synchroniser(): Promise<void>; enCours: boolean; compteRendu: string | null; erreur: string | null }`.

- [ ] **Step 1: Tests (rouges)** — `lib/motifs.test.ts` et `lib/texteRiche.test.ts` :

```ts
import { estUnFragment, motifsSansFragment } from './motifs'

const hoplite = { shopify_handle: 'hoplite', link_url: 'https://runesdechene.com/collections/Hoplite' }
test('relié par son métaobjet', () => {
  expect(estUnFragment({ handle: 'hoplite', collection: '' }, [hoplite])).toBe(true)
})
test('relié par la collection de son lien, sans tenir compte de la casse', () => {
  expect(estUnFragment({ handle: 'autre', collection: 'hoplite' }, [{ shopify_handle: null, link_url: hoplite.link_url }])).toBe(true)
})
test('une collection vide ne relie rien', () => {
  expect(estUnFragment({ handle: 'x', collection: '' }, [{ shopify_handle: null, link_url: null }])).toBe(false)
})
test('les motifs sans Fragment', () => {
  expect(motifsSansFragment([{ handle: 'hoplite', collection: '' }, { handle: 'loup', collection: 'loup' }], [hoplite]).map((m) => m.handle)).toEqual(['loup'])
})
```

```ts
import { texteRiche } from './texteRiche'
test('le texte riche de Shopify en paragraphes', () => {
  const v = JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ value: 'Un.' }] }, { type: 'paragraph', children: [{ value: 'Deux.' }] }] })
  expect(texteRiche(v)).toBe('Un.\n\nDeux.')
})
test('un texte simple passe tel quel, rien donne rien', () => {
  expect(texteRiche('Déjà simple')).toBe('Déjà simple')
  expect(texteRiche(null)).toBe('')
})
```

- [ ] **Step 2: Code.**
  - `lib/motifs.ts` : `estUnFragment` vrai si un Fragment a `shopify_handle === ill.handle`, ou si `ill.collection` n'est pas vide et que son `link_url` en minuscules finit par `/collections/{collection en minuscules}`.
  - `useSynchroFragments` — même enchaînement que l'ancien `FragmentsShopify.synchroniser` : `lireIllustrations()` → `synchroniserFragments(ills)` → invalider `['hub-fragments']`, `['hub-illustrations']` → compte rendu « {n} Fragment(s) mis à jour depuis Shopify » (`pluriel`) → pour chaque Fragment **visible**, `recalculerEmpreintes`, le compte rendu suivant « … · empreintes de scan : {i} / {total}… » ; un échec n'arrête pas les autres ; fin : « … · empreintes de scan recalculées » ou « … · empreintes de scan : {ok} / {total}, échec pour {noms} » → invalider `['hub-scans']`. Une erreur avant les empreintes → `erreur` (message reçu).
  - `OngletsFragments.tsx` : trois `NavLink` (« Les Fragments » `/boutique/fragments` `end`, « Correspondance Shopify » `/boutique/fragments/correspondance`, « Achats à associer » `/boutique/fragments/achats`), le lien actif souligné de `--color-accent` ; une prop `achats?: number` ajoutée au libellé (« Achats à associer · 35 »).
  - `Fragments.tsx` — modèle « liste + fiche en tiroir » : `EnTeteDePage surtitre="Fragments et boutique" titre="Les Fragments"` ; phrase « {n} Fragments · contenu tiré de Shopify, synchronisé {depuis(dernier synchronise_le)} · {aFilmer} à filmer pour le scan » (ou « jamais synchronisé ») ; `aDroite` le bouton contour « Synchroniser depuis Shopify » (« Synchronisation… » pendant) ; sous l'en-tête, `OngletsFragments` (sans nombre d'achats : il s'ajoute à la Task 5), le compte rendu et l'erreur (« Shopify ne répond pas : {message} ») ; un `Bloc` d'une ligne par Fragment (`Link` vers `{ pathname: String(id), search }`) : vignette 34 px de `illustration_url` (ou un rond `--color-vignette`), le nom, l'état — une `Balise` « Masqué » (teinte `sommeil`) si `!visible`, sinon `origine_nom` ou « Origine posée » ou « Origine à poser » —, une `Balise` « À filmer » (teinte `moderation`) si visible et sans vue ; `aFilmer` = Fragments visibles sans vue dans `lireScans` ; puis `MotifsSansFragment` ; `<Outlet />`.
  - `MotifsSansFragment.tsx` — si `useIllustrations` a répondu : `TitreDeSection titre="Motifs Shopify sans Fragment"` + « Des métaobjets Illustration qui ne correspondent à aucun Fragment : d’anciens motifs à trier dans Shopify, ou un nouveau Fragment à ajouter. » ; une ligne par motif (vignette, nom, « collection {c} » ou « aucune collection »), bouton « En faire un Fragment » désactivé sans collection avec le texte « Relie d’abord une collection à ce métaobjet dans Shopify » ; après succès, naviguer vers la fiche du nouvel id. Vide : « Tout est trié : chaque Illustration de Shopify est un Fragment. ». En panne : rien de plus que l'erreur de l'en-tête.
  - Router : `boutique/fragments` (enfant `:id` à la Task 4), ajouter à `ECRANS_FAITS`. `pnpm --filter hub-v2 add @mediapipe/tasks-vision@1.1.0`.
- [ ] **Step 3: Test de l'écran** (`Fragments.test.tsx`, api simulées comme aux plans 2-3) : la liste montre « Masqué », « Origine à poser » et « À filmer » selon les données ; « Synchroniser depuis Shopify » appelle `lireIllustrations` puis `synchroniserFragments` puis `recalculerEmpreintes` pour chaque Fragment visible seulement, et le compte rendu dit « 2 Fragments mis à jour depuis Shopify · empreintes de scan recalculées » ; un échec de `recalculerEmpreintes` pour « Hoplite » donne « … échec pour Hoplite » ; « En faire un Fragment » est désactivé pour un motif sans collection.
- [ ] **Step 4:** `pnpm test && pnpm lint && pnpm build` ; commit `feat(hub-v2): les Fragments — la liste et la synchro Shopify`.

---

### Task 4: La fiche d'un Fragment — origine, culture, visibilité, scan

**Files:** `components/TiroirFragment.tsx` (+test), `components/CarteDOrigine.tsx` (+test), `components/ScanDuFragment.tsx`, `api/fragments.ts` (ajout), `hooks/useFragments.ts` (ajout), router.

**Interfaces:**
- Consumes : `enregistrer_fragment(p_id integer, p_origine_lat double precision, p_origine_lng double precision, p_origine_nom text, p_visible boolean, p_theme text)` (chaîne vide = effacer ; refus « Une origine a une latitude et une longitude, ou aucune », « Culture inconnue : … ») ; `retirer_empreinte(p_id bigint)` ; `recalculerEmpreintes` (Task 3) ; `STYLE_DE_CARTE`, `maplibregl` (`shared/lib/maplibre.ts`).
- Produces : `enregistrerFragment(f: { id: number; origine_lat: number | null; origine_lng: number | null; origine_nom: string | null; visible: boolean; theme: string | null }): Promise<void>` (envoie `p_origine_nom: f.origine_nom ?? ''`, `p_theme: f.theme ?? ''`) ; `useEcritureFragment(id)` (invalide `['hub-fragments']`) ; `CarteDOrigine({ points: { id: number; lat: number; lng: number; image: string | null; nom: string }[]; choisi: number; onPoser: (lat: number, lng: number) => void })`.

- [ ] **Step 1: Tests (rouges)** — `TiroirFragment.test.tsx` : la fiche d'un Fragment sans fiche Shopify montre « Aucune fiche Shopify reliée » ; poser un point (prop `onPoser` de la carte simulée) puis « Enregistrer » appelle `enregistrerFragment({ id: 7, origine_lat: 43.1, origine_lng: 5.9, origine_nom: 'Sparte', visible: true, theme: null })` et affiche « Enregistré. » ; « Retirer le point » puis « Enregistrer » envoie `origine_lat: null, origine_lng: null` ; l'erreur de la base s'affiche ; `/boutique/fragments/999` → « Fragment introuvable. » et « Retour à la liste ». `CarteDOrigine.test.tsx` (faux MapLibre du setup) : un clic simulé appelle `onPoser(lat, lng)`.
- [ ] **Step 2: Code.**
  - `TiroirFragment.tsx` — `Tiroir` (titre le nom, retour = liste + recherche) ; branches lecture / erreur (« Réessayer ») / introuvable comme `TiroirCompte` ; la fiche passée en `key` (un `useState` par champ). Trois sections :
    1. **Dans Shopify** (lecture seule) : « de la collection {heritage} » si présent ; si `!shopify_handle`, le bandeau « Aucune fiche Shopify reliée : synchronise, ou vérifie que sa collection ({link_url ?? 'aucun lien'}) est bien celle de son métaobjet. » ; Résumé, Son histoire (`texteRiche`, paragraphes), Récit audio (`<audio controls preload="none">`, « lu par {narrateur} »), Artiste — chaque vide dit « vide dans Shopify » ; puis « Ce contenu se corrige dans Shopify (Contenu → Métaobjets → Illustrations), puis « Synchroniser ». ».
    2. **Sur la carte d’Explore** : « Lieu d’origine » (texte, exemple « Sparte, Péloponnèse »), la position (« 43.1000, 5.9000 — un clic sur la carte le déplace » ou « Un clic sur la carte pose son point d’origine. »), `CarteDOrigine` (tous les Fragments posés, le choisi en avant), « Retirer le point » (si posé), « Culture (la couleur de son éclat sur la carte) » : un `select` (« Aucune (rouge de la marque) » + les cultures) et une pastille de la couleur (variable CSS `--couleur`), « Visible dans l’appli » (case) ; « Enregistrer » → `enregistrerFragment` ; « Enregistré. » effacé à la modification d'un champ.
    3. **Le scan** : `ScanDuFragment` — « {n} empreintes d’illustration · Recalculer » (bouton ; « Calcul… » pendant), « À filmer : aucune vue du vrai t-shirt (depuis le scanner d’Explore, en admin). » si visible et sans vue, une ligne par vue « Vue du {dateCourte(le)} · {par} » + « Retirer » (confirmation en ligne « Retirer cette vue ? »), « Scans : {scans7} en 7 jours · {scans30} en 30 jours » ; chaque action invalide `['hub-scans']`.
  - `CarteDOrigine.tsx` — MapLibre (`STYLE_DE_CARTE`, centre `[12, 46]`, zoom 3) ; un clic → `onPoser` ; un marqueur par point : un élément `div` de classe `.pastilleDOrigine` (et `.pastilleDOrigineChoisie`), l'image passée par `el.style.setProperty('--image', \`url("${image}")\`)`, la première lettre du nom sans image ; les marqueurs sont retirés au changement de points. Ne parle pas à Supabase.
  - Router : enfant `:id` de `boutique/fragments` (`TiroirFragment`).
- [ ] **Step 3:** tests, lint, build ; commit `feat(hub-v2): la fiche d'un Fragment — origine, culture, scan`.

---

### Task 5: Correspondance Shopify et achats à associer

**Files:** `api/correspondance.ts`, `api/achats.ts`, `lib/achats.ts` (+test), `hooks/useCorrespondance.ts`, `hooks/useAchats.ts`, `components/Correspondance.tsx` (+test), `components/Achats.tsx` (+test) ; Modify `features/accueil/components/Attente.tsx`, router.

**Interfaces:**
- Consumes : table `shopify_unlocks` (`id, shopify_tag, unlock_type, unlock_ref_id, created_at` ; unique `(shopify_tag, unlock_type, unlock_ref_id)` ; écriture `_is_admin()` — R1) ; `hub_achats`, `hub_associer_achat`, `hub_classer_achat` (Task 1) ; `lireFragments` (Task 3).
- Produces : `type Correspondance = { id: number; shopify_tag: string; unlock_ref_id: number; created_at: string | null }` ; `lireCorrespondances()` (tri `created_at` décroissant), `ajouterCorrespondance(tag: string, fragmentId: number)` (insert `{ shopify_tag: etiquetteNormale(tag), unlock_type: 'fragment', unlock_ref_id }` ; code `23505` → `throw new Error('Cette correspondance existe déjà.')`), `retirerCorrespondance(id)` ; `type Achat = { id: number; quand: string | null; statut: 'pending' | 'no_match'; email: string | null; commande: string | null; tag: string | null; fragment: number | null; compte: { id: string; nom: string } | null }` ; `lireAchats()`, `associerAchat(id, fragment)`, `classerAchat(id)` ; `lib/achats.ts` : `etiquetteNormale(tag: string): string` (rognée, minuscules), `tagsDuJournal(tag: string | null): string[]`, `STATUTS_ACHAT = { pending: 'Attend son inscription', no_match: 'Aucun Fragment trouvé' }`.

- [ ] **Step 1: Tests (rouges)** — `lib/achats.test.ts` :

```ts
import { etiquetteNormale, tagsDuJournal } from './achats'

test('une étiquette tapée comme le webhook la lit', () => {
  expect(etiquetteNormale('  Fragment:Hoplite ')).toBe('fragment:hoplite')
})
test('les étiquettes trouvées d’une commande sans correspondance', () => {
  expect(tagsDuJournal('tags_found:nw_era,scandinave,animal,nw_era|no_unlock_match')).toEqual(['nw_era', 'scandinave', 'animal'])
})
test('un journal de diagnostic ne donne aucune étiquette', () => {
  expect(tagsDuJournal('debug:no_token|pids:123')).toEqual([])
  expect(tagsDuJournal(null)).toEqual([])
})
```

  `Correspondance.test.tsx` : « fragment:Hoplite » + Hoplite → `ajouterCorrespondance('fragment:Hoplite', 7)` (la normalisation est dans l'api, testée par la lib) ; l'erreur « Cette correspondance existe déjà. » s'affiche ; « Retirer » demande « Retirer cette correspondance ? » et seul « Confirmer » appelle `retirerCorrespondance`. `Achats.test.tsx` : une ligne `pending` montre « Attend son inscription » sans bouton ; une ligne `no_match` avec compte montre ses étiquettes (`tagsDuJournal`), « Associer un Fragment » (select + bouton) et « Rien à débloquer » ; « Rien à débloquer » appelle `classerAchat(41)` et invalide `['hub-achats']` et `['hub-ouverture']` ; une ligne `no_match` sans compte n'a que « Rien à débloquer ».
- [ ] **Step 2: Code.**
  - `Correspondance.tsx` : `EnTeteDePage surtitre="Fragments et boutique" titre="La correspondance Shopify" phrase="Une étiquette de produit Shopify débloque un Fragment : quand un client achète un produit qui la porte, le Fragment est à lui."` ; `OngletsFragments` ; un formulaire en ligne (« Étiquette Shopify », exemple `fragment:hoplite` ; `select` des Fragments ; « + Ajouter », désactivé tant qu'un des deux manque) ; un `Bloc` d'une ligne par correspondance : l'étiquette en `Balise` (teinte `boutique`), « débloque », la vignette et le nom du Fragment (ou « Fragment n° {id} »), « Retirer » avec confirmation en ligne. Erreurs sous le bloc.
  - `Achats.tsx` : `EnTeteDePage titre="Les achats à associer" phrase="{n} achats attendent : {k} sans Fragment trouvé, {p} en attente d’une inscription."` ; `OngletsFragments` ; `ChoixSegmente` « Sans Fragment » (`no_match`, par défaut) / « En attente d’inscription » (`pending`), dans l'adresse (`?statut=`) ; un `Bloc` d'une ligne par achat : « Commande n° {commande ?? '—'} · {dateCourte(quand)} », l'e-mail, le compte (`Link` vers `/communaute/comptes/{id}`, ou « aucun compte »), la `Balise` du statut (`STATUTS_ACHAT`), les étiquettes trouvées ; pour `no_match` les actions de R3 ; vide : « Aucun achat n’attend. ». Après une décision : invalider `['hub-achats']`, `['hub-ouverture']`, `['hub-compte']`.
  - `Attente.tsx` : la ligne des achats va vers `/boutique/fragments/achats`, détail « Commandes sans Fragment trouvé, ou en attente d’une inscription ».
  - `Fragments.tsx`, `Correspondance.tsx`, `Achats.tsx` passent `achats={useAchats().data?.length}` à `OngletsFragments`.
  - Router : `boutique/fragments/correspondance`, `boutique/fragments/achats`.
- [ ] **Step 3:** tests, lint, build ; commit `feat(hub-v2): la correspondance Shopify et les achats à associer`.

---

### Task 6: Associer un Fragment à la main depuis la fiche d'un compte ; le compte du stand

**Files:** `features/communaute/api/fragmentsDuCompte.ts`, `hooks/useFragmentsDuCompte.ts`, `components/AssocierFragment.tsx` (+test), `components/TiroirCompteDuStand.tsx` (+test) ; Modify `components/TiroirCompte.tsx`, `components/Comptes.tsx`, router.

**Interfaces:**
- Consumes : `hub_associer_fragment`, `hub_retirer_fragment` (Task 1) ; `appelerFonction`, `lireReponse` (Task 2) ; la fonction `stand-create-account` (POST `{ email, firstName, newsletter }` → `{ success: true, action?: 'already_exists', user: { id } }` ou `{ error }`).
- Produces : `lireFragmentsAssociables(): Promise<{ id: number; nom: string; image: string | null }[]>` (`title_fragments` `id, name, illustration_url, image_url`, tri `name` ; `image` = `illustration_url ?? image_url`) ; `associerFragment(compte: string, fragment: number)`, `retirerFragment(compte: string, fragment: number)` ; `creerCompteDuStand(c: { email: string; prenom: string; newsletter: boolean }): Promise<string>` (rend l'id ; `prenom` vide → `firstName: null`) ; `useFragmentsAssociables()`, `useEcritureFragmentsDuCompte(compte)` (invalide `['hub-compte', compte]`, `['hub-comptes']`).

- [ ] **Step 1: Tests (rouges)** — `AssocierFragment.test.tsx` : le `select` n'offre que les Fragments que le compte n'a pas ; « Associer » appelle `associerFragment('u1', 9)` ; « Retirer » sur Hoplite demande « Retirer Hoplite ? » et seul « Confirmer » appelle `retirerFragment('u1', 7)` ; l'erreur de la base s'affiche. `TiroirCompteDuStand.test.tsx` : sans e-mail valide (pas de `@`) → « Une adresse e-mail est nécessaire. » sans appel ; un envoi réussi navigue vers `/communaute/comptes/{id}` ; la case newsletter est décochée par défaut et part telle quelle (`newsletter: false`).
- [ ] **Step 2: Code.**
  - `AssocierFragment.tsx` (`{ compte: string; fragments: FicheDeCompte['fragments'] }`) : remplace le contenu du bloc « Ses Fragments » de `TiroirCompte` — les lignes actuelles (vignette, nom, « débloqué par une commande » / « associé à la main », date) avec, à droite, « Retirer » (confirmation en ligne) ; sous le bloc, « Associer un Fragment » : un `select` (`aria-label="Fragment à associer"`, « Choisir un Fragment ») et un bouton « Associer », désactivé sans choix ou pendant l'écriture. `TiroirCompte.tsx` reste sous 400 lignes.
  - `TiroirCompteDuStand.tsx` — `Tiroir titre="Un compte au stand"` (retour = liste + recherche) : E-mail (obligatoire), Prénom (« Facultatif : il personnalise l’e-mail de bienvenue de la boutique. »), case « Il veut recevoir la newsletter » + « À lui demander : sans son accord, pas de newsletter. » ; « Créer le compte » (« Création… » pendant) → `creerCompteDuStand` → naviguer vers la fiche (l'association se fait là) ; erreur de la fonction sous le formulaire.
  - `Comptes.tsx` : à droite de l'en-tête, avant « Exporter en CSV », un lien contour « + Compte du stand » vers `{ pathname: 'nouveau', search }`. Router : enfant `nouveau` de `communaute/comptes` (avant `:id`).
- [ ] **Step 3:** tests, lint, build ; commit `feat(hub-v2): associer un Fragment à la main, le compte du stand`. Le compte du stand ne marche qu'en ligne (fonction Netlify) : à vérifier à la Task 12.

---

### Task 7: Photos et avis — la file à deux volets

**Files:** `api/contributions.ts`, `lib/contribution.ts` (+test), `hooks/useContributions.ts`, `components/Photos.tsx` (+test), `components/LectureContribution.tsx`, `components/Photos.module.css`, router.

**Interfaces:**
- Consumes : `hub_contributions` (Task 1) ; existantes gardées (`_is_staff`, mig 513) : `moderate_submission(p_submission_id uuid, p_status text, p_crowns integer)` (couronnes versées une seule fois, `rewarded_at`), `delete_photo_submission(p_submission_id uuid)`, `update_submission_message(p_submission_id uuid, p_message text)`, `add_tag_to_submission(p_submission_id uuid, p_tag_id uuid)`, `remove_tag_from_submission(…)`, `create_photo_tag(p_name text) → uuid` ; `get_photo_tags()` (gardée par la 520).
- Produces : `type StatutContribution = 'pending' | 'approved' | 'archived'` ; `type Filtre = StatutContribution | 'toutes'` ; `type PhotoDeContribution = { id: string; url: string; chemin: string | null; taille: string | null; produit_id: string | null; produit_handle: string | null; produit_titre: string | null; media: string | null; communaute: boolean; mur: boolean }` ; `type Contribution` (les champs de la Task 1, `images: PhotoDeContribution[]`, `etiquettes: { id: string; nom: string }[]`) ; `type ListeContributions = { total: number; compteurs: { a_valider: number; publiees: number; archivees: number; au_mur: number; plus_ancienne: string | null }; lignes: Contribution[] }` ; `lireContributions({ filtre, recherche, limite, decalage })`, `lireEtiquettes()`, `modererContribution(id, statut: StatutContribution, couronnes?: number)`, `modifierMessage(id, message: string | null)`, `ajouterEtiquette(id, etiquette)`, `retirerEtiquette(id, etiquette)`, `creerEtiquette(nom): Promise<string>` ; `lib/contribution.ts` : `STATUTS = { pending: 'À valider', approved: 'Publiée', archived: 'Archivée' }`, `estUneVideo(url)` (`.mp4 .mov .webm .avi .mkv .m4v`), `texteAlternatif(nom, hauteurCm, taille)`, `nomDeFichier(nom, instagram, rang, url)` ; `useContributions(criteres)` (`['hub-contributions', criteres]`, keepPreviousData), `useEcritureContribution()` (chaque succès invalide `['hub-contributions']` et `['hub-ouverture']`).

- [ ] **Step 1: Tests (rouges)** — `lib/contribution.test.ts` :

```ts
import { estUneVideo, nomDeFichier, texteAlternatif } from './contribution'

test('le texte alternatif de Shopify, comme l’ancien Hub', () => {
  expect(texteAlternatif('Pierre', 183, 'M')).toBe('Pierre mesure 1m83 et porte du M')
  expect(texteAlternatif('Pierre', 183, 'none')).toBe('Pierre mesure 1m83')
  expect(texteAlternatif('Pierre', null, 'L')).toBe('Pierre porte du L')
  expect(texteAlternatif('  ', null, null)).toBe('Communauté Runes de Chêne')
})
test('le nom d’un fichier téléchargé', () => {
  expect(nomDeFichier('Brune / K.', '@brune', 0, 'https://x.supabase.co/a/b.jpg?t=1')).toBe('Brune K. - @brune - 1.jpg')
  expect(nomDeFichier('Brune', null, 2, 'https://x/c')).toBe('Brune - 3.webp')
})
test('une vidéo se reconnaît à son extension', () => {
  expect(estUneVideo('https://x/a.MOV')).toBe(true)
  expect(estUneVideo('https://x/a.webp')).toBe(false)
})
```

  (`nomDeFichier` : nom et Instagram nettoyés de `< > : " / \ | ? *` et des espaces en trop ; l'extension est ce qui suit le dernier point du chemin sans la requête, `webp` s'il n'y en a pas.)
  `Photos.test.tsx` : la file (filtre « À valider » par défaut) et la première contribution choisie ; les quatre tuiles ; « Valider et publier » avec 15 couronnes appelle `modererContribution(id, 'approved', 15)` et passe à la suivante ; une contribution déjà récompensée n'a pas de champ de couronnes et dit « Déjà récompensée le … » ; « Archiver » appelle `modererContribution(id, 'archived')` ; le filtre et la recherche sont dans l'adresse (`?filtre=approved&q=brune`) ; file vide : « Aucune contribution ici. ».
- [ ] **Step 2: Code.**
  - `Photos.tsx` — la file à deux volets du modèle 596:1319, calquée sur `Signalements.tsx` : `EnTeteDePage surtitre="Fragments et boutique" titre="Photos et avis" phrase="{a_valider} contributions attendent ; la plus ancienne depuis {depuis(plus_ancienne)}."` (ou « Rien n’attend. ») ; `aDroite` : « Télécharger depuis le » (Task 8) ; quatre `Tuile` : « À valider », « Publiées », « Archivées », « Photos au mur » (À trancher n° 2) ; `ChoixSegmente` « À valider / Publiées / Archivées / Toutes » (`?filtre=`, `pending` par défaut), `ChampDeRecherche` « Un nom, un e-mail… » (`?q=`) ; la sélection dans l'adresse (`?c=<id>`, la première par défaut ; après une décision, la suivante sinon la précédente) ; `Pages` (50 par page, `?page=`) ; à gauche un `Bloc` de lignes-boutons : vignette de la première photo (`<video muted>` pour une vidéo), le nom, « {n} fichiers · {dateCourte(quand)} », la `Balise` du statut ; à droite `LectureContribution`.
  - `LectureContribution.tsx` — **le client** : nom en Bebas, `Balise` du rôle (Client, Ambassadeur, Partenaire) et du statut, « Diffusion OK » si `diffusion`, puis e-mail, Instagram, lieu et code postal, département, date ; **le produit et la note** : « Porte : {produit} · taille {taille} », « Expérience ★★★★☆ · Produits ★★★★★ » (étoiles pleines et vides, `aria-label="Expérience : 4 sur 5"`), « Hauteur : {hauteur} cm · Épaules : {epaules} cm » si présents ; **le message** : le texte, « Modifier » → `textarea` (500 caractères) + Enregistrer / Annuler, « + Ajouter un message » s'il est vide ; la note de l'équipe en retrait (« Privée, jamais publiée ») ; **les photos** : une `PhotoDeContribution` par image (Task 8) ; **les étiquettes** : des `Balise` « #{nom} » avec « Retirer », un `select` des étiquettes absentes + « Ajouter », et « + Nouvelle étiquette » (texte → `creerEtiquette` puis `ajouterEtiquette`) ; **les décisions** en bas : « Télécharger » (Task 8), « Supprimer » (Task 8), « Archiver » (si `pending` ou `approved`), et — si `pending` ou `archived` — « Couronnes offertes » (nombre ≥ 0, 10 par défaut, absent si `recompensee_le` : « Déjà récompensée le {dateCourte} ») et « Valider et publier » (plein, accent).
  - Router : `boutique/photos`, ajouter à `ECRANS_FAITS`.
- [ ] **Step 3:** tests, lint, build ; commit `feat(hub-v2): photos et avis — la file à deux volets`.

---

### Task 8: Photos et avis — les canaux de chaque photo, le produit, télécharger, supprimer

**Files:** `api/shopify.ts` (ajouts), `api/contributions.ts` (ajouts, +`contributions.test.ts`), `lib/archive.ts` (+test), `components/PhotoDeContribution.tsx` (+test), `components/ChoixDuProduit.tsx`, `components/LectureContribution.tsx`, `components/Photos.tsx`, `package.json` (`"jszip": "3.10.1"`).

**Interfaces:**
- Consumes : existantes gardées : `set_submission_image_wall(p_image_id uuid, p_show boolean)`, `set_submission_image_community(p_image_id uuid, p_show boolean)`, `set_submission_image_shopify_product(p_image_id uuid, p_product_id text, p_handle text, p_title text)`, `clear_submission_image_shopify_product(p_image_id uuid)` (remet aussi `show_in_community` à faux), `set_submission_image_media(p_image_id uuid, p_media_id text)` (`''` = effacer), `delete_submission_image(p_image_id uuid)` ; bucket `community-photos` (effacement admin, Task 1).
- Produces — `api/shopify.ts` : `type ProduitShopify = { id: string; titre: string; handle: string; image: string | null; prix: string | null }` ; `chercherProduits(terme: string): Promise<ProduitShopify[]>` (moins de 2 caractères → `[]` ; requête GraphQL de l'ancien `searchShopifyProducts`, titre échappé, 8 résultats, prix au format `fr-FR` sans décimales) ; `pousserImage(produitId, url, alt): Promise<string>` (POST `products/{id}/images.json`, rend l'id) ; `retirerImage(produitId, mediaId): Promise<void>` (DELETE `products/{id}/images/{media}.json`, un 404 est toléré). `api/contributions.ts` : `montrerAuMur(photoId, oui)`, `montrerDansCommunaute(photoId, oui)`, `relierProduit(photoId, p: ProduitShopify)`, `delierProduit(photo)` (retire d'abord l'image Shopify si `media`), `mettreSurLaFiche(c: Contribution, photo, oui)` (oui : `pousserImage(photo.produit_id, photo.url, texteAlternatif(c.nom, c.hauteur, photo.taille))` puis `set_submission_image_media` ; non : `retirerImage` puis `set_submission_image_media(id, '')`), `supprimerPhoto(photo)` et `supprimerContribution(c)` (R8 : pour chaque photo, `retirerImage` si `media` — une erreur arrête tout —, puis `storage.from('community-photos').remove([chemins])`, puis `delete_submission_image` ou `delete_photo_submission`). `lib/archive.ts` : `fichiersDeContributions(cs: Contribution[]): { url: string; nom: string }[]` (pure : chaque photo, `nomDeFichier`) et `telechargerArchive(fichiers, nomDArchive): Promise<{ ok: number; manques: number }>` (`jszip` ; un fichier qui ne se lit pas est compté, pas bloquant ; un seul fichier → téléchargé sans archive).

- [ ] **Step 1: Tests (rouges)** — `lib/archive.test.ts` : `fichiersDeContributions` donne `Brune - 1.webp`, `Brune - 2.webp` pour deux photos et suit l'ordre des photos. `PhotoDeContribution.test.tsx` : « Fiche produit » est désactivé sans produit relié, avec le texte « Relie d’abord un produit » ; « Mur » appelle `montrerAuMur(id, true)` ; relier un produit (recherche simulée) appelle `relierProduit`. Dans `Photos.test.tsx`, ajouter : « Supprimer » demande « Supprimer cette contribution et ses {n} photos ? » ; « Confirmer » appelle `supprimerContribution` ; si elle rejette (« Suppression image: HTTP 500 »), le message s'affiche et la contribution reste dans la file. Et un test de l'api (`contributions.test.ts`, `supabase` et `retirerImage` simulés) : pour une photo avec `media`, `retirerImage` est appelé **avant** `storage.remove`, lui-même avant `delete_photo_submission` ; si `retirerImage` rejette, ni `storage.remove` ni la RPC ne sont appelés.
- [ ] **Step 2: Code.**
  - `PhotoDeContribution.tsx` — une photo (lien vers l'image en grand, nouvel onglet ; `<video controls>` pour une vidéo), sa taille (« Aucun produit » pour `none`), **ses canaux** : quatre interrupteurs (cases stylées) — « Communauté » (`communaute`, bloc communauté de la fiche produit ; désactivé sans produit), « Mur » (`mur`, le mur « Ils nous portent »), « Fiche produit » (`media !== null`, la galerie Shopify du produit ; désactivé sans produit), « Média » (À trancher n° 1 : par défaut l'accord de diffusion de la contribution, `diffusion`, en lecture seule) ; **le produit** : « Relié à {produit_titre} » + « Retirer », sinon « Relier à un produit » → `ChoixDuProduit` ; « Télécharger » (lien `?download=` de l'adresse publique Supabase, nom `nomDeFichier`) et « Supprimer la photo » (confirmation en ligne). Chaque bascule est désactivée pendant son écriture ; une erreur s'affiche sous la photo.
  - `ChoixDuProduit.tsx` — `ChampDeRecherche` « Rechercher un produit… » (300 ms de calme : la brique le fait) → `chercherProduits` → une ligne-bouton par produit (vignette, titre, prix) ; « Annuler ».
  - `LectureContribution.tsx` : « Télécharger » → `telechargerArchive(fichiersDeContributions([c]), '{nom}.zip')` ; « Supprimer » (confirmation en ligne) → `supprimerContribution`. `Photos.tsx` `aDroite` : une date « depuis le » + « Télécharger (.zip) » (« {n} contribution(s) · {k} fichier(s) » ; désactivé à 0) sur les contributions de la page affichée créées depuis cette date, archive `photos-communaute-depuis-{AAAAMMJJ}.zip`, progression « Téléchargement {i}/{n}… ».
  - `pnpm --filter hub-v2 add jszip@3.10.1`.
- [ ] **Step 3:** tests, lint, build ; commit `feat(hub-v2): photos et avis — canaux, produit, téléchargement, suppression propre`.

---

### Task 9: Écoutes audio — le tableau de bord

**Files:** `api/ecoutes.ts`, `api/shopify.ts` (ajouts), `lib/ecoutes.ts` (+test), `hooks/useEcoutes.ts`, `components/Ecoutes.tsx` (+test), router.

**Interfaces:**
- Consumes : `get_fragment_audio_stats()` (gardée) → `[{ illustration_handle, ecoutes, completions, taux, progression, mesurables, ecoutes_motif, ecoutes_produit, derniere_ecoute }]`.
- Produces : `type EcouteDUnFragment` (ces champs ; `taux`, `progression`, `derniere_ecoute` nullables) ; `lireEcoutes()` ; `api/shopify.ts` : `lireInventaireAudio(): Promise<{ illustrations: { handle: string; nom: string; aAudio: boolean }[]; tronque: boolean }>` (repris de `fetchIllustrations` ; zéro résultat → `InventaireVide('Aucune Illustration retournée par Shopify (type "illustrations") — le type a-t-il changé ?')`) et `lireProduitsSansIllustration(): Promise<{ produits: { handle: string; titre: string }[]; tronque: boolean }>` (repris de `fetchProduitsSansIllustration`) ; `lib/ecoutes.ts` : `SEUIL_DECISION = 20`, `resumeDesEcoutes(stats): { ecoutes: number; completions: number; taux: number | null; progression: number | null; mesurables: number; derniere: string | null; assez: boolean }` ; `useEcoutes()`, `useInventaireAudio()`, `useProduitsSansIllustration()` (trois requêtes indépendantes, `retry: false` pour les deux Shopify).

- [ ] **Step 1: Tests (rouges)** — `lib/ecoutes.test.ts` :

```ts
import { resumeDesEcoutes } from './ecoutes'

const ligne = (ecoutes: number, completions: number, progression: number | null, mesurables: number, derniere: string | null) =>
  ({ illustration_handle: 'h', ecoutes, completions, taux: null, progression, mesurables, ecoutes_motif: 0, ecoutes_produit: 0, derniere_ecoute: derniere })

test('rien écouté : pas de taux, pas de quoi trancher', () => {
  expect(resumeDesEcoutes([])).toMatchObject({ ecoutes: 0, taux: null, progression: null, assez: false, derniere: null })
})
test('le taux sur toutes les écoutes, à un chiffre après la virgule', () => {
  expect(resumeDesEcoutes([ligne(20, 7, null, 0, null), ligne(10, 3, null, 0, null)])).toMatchObject({ ecoutes: 30, taux: 33.3, assez: true })
})
test('la progression pèse chaque Fragment par ses écoutes mesurées', () => {
  expect(resumeDesEcoutes([ligne(4, 0, 50, 3, null), ligne(1, 0, 100, 1, null)]).progression).toBe(62.5)
})
test('la dernière écoute est la plus récente', () => {
  expect(resumeDesEcoutes([ligne(1, 0, null, 0, '2026-10-01T00:00:00Z'), ligne(1, 0, null, 0, '2026-10-12T00:00:00Z')]).derniere).toBe('2026-10-12T00:00:00Z')
})
```

  `Ecoutes.test.tsx` : 12 écoutes → « Pas encore de quoi trancher » ; pendant le chargement de l'inventaire, « Lecture de l’inventaire… » et **aucun** « 0 » dans les relevés ; un `AccesShopifyRefuse('read_metaobjects')` → « Inventaire indisponible : la portée read_metaobjects manque à l’app Shopify. » et les lignes des écoutes restent affichées ; une erreur de `lireEcoutes` → « Lecture des écoutes impossible : {message} ».
- [ ] **Step 2: Code.** `Ecoutes.tsx` — `EnTeteDePage surtitre="Fragments et boutique" titre="Les écoutes" phrase="Dernière écoute {depuis(derniere)}."` (ou « Personne n’a encore écouté de Fragment. ») ; quatre `Tuile` : « Écoutes », « Vont au bout » (`{taux} %` ou « — »), « Récit parcouru » (`{progression} %` ou « — »), « Fragments écoutés » ; **le verdict** : si `assez`, « {taux} % des écoutes vont jusqu’au bout, sur {ecoutes} écoutes réelles de {n} Fragments. » et, si progression, « Ceux qui s’arrêtent en chemin parcourent {progression} % du récit en moyenne, sur {mesurables} écoutes mesurées. » ; sinon « Pas encore de quoi trancher : {ecoutes} écoute(s) réelle(s). Il en faut une vingtaine avant que ce taux veuille dire quelque chose : un seul auditeur qui termine suffit à afficher 100 %. » ; vide : « Le compteur démarre à la première écoute qui dépasse dix secondes. » ; **la couverture** (`TitreDeSection`) : trois relevés, chacun « Lecture de l’inventaire… » / panne / nombre + liste des noms (+ « liste tronquée ») — « Illustrations sans voix off », « Fragments enregistrés que personne n’a écoutés » (Illustrations avec voix off absentes des écoutes), « Produits actifs sans Illustration reliée — le lecteur y reste muet » ; **par Fragment** : un `Bloc` d'une ligne par Fragment — le nom (celui de l'inventaire pour ce `handle`, sinon le `handle`), « {ecoutes} écoutes · {completions} au bout », « {taux} % » suivi de « · à confirmer » sous 20 écoutes, « {progression} % du récit » (« · {mesurables}/{ecoutes} mesurées » si moins) ou « pas encore mesurée », « {motif} motif · {produit} produit », `dateCourte(derniere_ecoute)`. Route `boutique/audio`, `ECRANS_FAITS`.
- [ ] **Step 3:** tests, lint, build ; commit `feat(hub-v2): les écoutes audio`.

---

### Task 10: Synchro Shopify — lien compte-client et étiquette de provenance

**Files:** `api/synchro.ts`, `api/shopify.ts` (ajout), `lib/provenance.ts` (+test), `hooks/useSynchro.ts`, `components/Synchro.tsx` (+test), router.

**Interfaces:**
- Consumes : fonctions `shopify-sync` (POST `{ shop }` → `{ success, shopifyTotal, supabaseTotal, updated, created, skipped, logs: string[] }` ou `{ error }`) et `shopify-batch-tags` (POST `{ items: { customerId, email, tags }[] }`, 25 au plus → `{ results: { email, success, reason? }[] }`, admin depuis la Task 2) ; `hub_comptes_clients()` (Task 1).
- Produces : `api/shopify.ts` : `type ClientShopify = { id: number; email: string | null; tags: string; created_at: string }` ; `pageSuivante(lien: string | null): string | null` ; `lireClientsShopify(): Promise<ClientShopify[]>` (GET `customers.json?limit=250&fields=id,email,tags,created_at` par le proxy, puis les pages suivantes tant que l'en-tête `Link` a `rel="next"`) ; `api/synchro.ts` : `relierComptesEtClients(): Promise<ResultatLiaison>`, `lireComptesClients(): Promise<CompteClient[]>`, `envoyerEtiquettes(lot: Etiquetage[]): Promise<{ email: string; success: boolean; reason?: string }[]>` ; `lib/provenance.ts` : `type CompteClient = { email: string; client: number; provenance: string | null }`, `type Etiquetage = { customerId: number; email: string; tags: string }`, `etiquettesDeProvenance(compte, client: ClientShopify | undefined): string | null`, `preparerEtiquetage(comptes, clients): { lots: Etiquetage[][]; ignores: number }` (lots de 25), `envoyerParLots(lots, envoyer, onProgres: (p: Progres) => void, pauseMs = 1000): Promise<Progres>` avec `Progres = { fait: number; total: number; erreurs: string[]; erreursCompte: number }` (`erreurs` : les lignes à montrer ; `erreursCompte` : le nombre de clients non étiquetés).

- [ ] **Step 1: Tests (rouges)** — `lib/provenance.test.ts` :

```ts
import { vi } from 'vitest'
import { envoyerParLots, etiquettesDeProvenance, preparerEtiquetage } from './provenance'

const client = (tags: string) => ({ id: 1, email: 'a@b.fr', tags, created_at: '2025-01-01T00:00:00Z' })

test('un joueur : source:app et app-player, ses étiquettes gardées (héritage compris)', () => {
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'flyer' }, client('vip, heritage-vikings')))
    .toBe('vip, heritage-vikings, source:app, app-player')
})
test('un client de la boutique : source:shopify seule', () => {
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'shopify' }, client(''))).toBe('source:shopify')
})
test('déjà une source, ou pas de client Shopify : on ne touche à rien', () => {
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'app' }, client('source:stand'))).toBeNull()
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'app' }, undefined)).toBeNull()
})
test('des lots de 25, les ignorés comptés', () => {
  const comptes = Array.from({ length: 30 }, (_, i) => ({ email: `${String(i)}@x.fr`, client: i, provenance: 'app' }))
  const clients = comptes.slice(0, 27).map((c) => ({ id: c.client, email: c.email, tags: '', created_at: '' }))
  const { lots, ignores } = preparerEtiquetage(comptes, clients)
  expect(lots.map((l) => l.length)).toEqual([25, 2])
  expect(ignores).toBe(3)
})
test('un lot en échec réseau compte ses clients en erreur et n’arrête pas les autres', async () => {
  const lot = (n: number) => Array.from({ length: n }, (_, i) => ({ customerId: i, email: `${String(i)}@x.fr`, tags: 'source:app' }))
  const envoyer = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce([{ email: '0@x.fr', success: true }])
  const fin = await envoyerParLots([lot(2), lot(1)], envoyer, () => undefined, 0)
  expect(fin).toEqual({ fait: 3, total: 3, erreursCompte: 2, erreurs: ['Lot 1 — erreur réseau : réseau'] })
  expect(envoyer).toHaveBeenCalledTimes(2)
})
test('un client refusé par Shopify est nommé', async () => {
  const envoyer = vi.fn().mockResolvedValue([{ email: 'a@b.fr', success: false, reason: 'Customer not found' }])
  const fin = await envoyerParLots([[{ customerId: 1, email: 'a@b.fr', tags: 'source:app' }]], envoyer, () => undefined, 0)
  expect(fin).toEqual({ fait: 1, total: 1, erreursCompte: 1, erreurs: ['a@b.fr — Customer not found'] })
})
```

  et `api/shopify.test.ts` :

```ts
import { pageSuivante } from './shopify'

test('la page suivante de Shopify', () => {
  expect(pageSuivante('<https://s.myshopify.com/admin/api/2026-01/customers.json?page_info=abc&limit=250>; rel="next"')).toBe('customers.json?page_info=abc&limit=250')
  expect(pageSuivante('<https://s/admin/api/2026-01/customers.json?page_info=z>; rel="previous"')).toBeNull()
  expect(pageSuivante(null)).toBeNull()
})
```

  `Synchro.test.tsx` : « Lancer la liaison » montre « 412 clients lus — 3 reliés, 1 compte créé, 408 déjà à jour. » et les journaux ; « Poser les étiquettes » appelle `envoyerEtiquettes` avec des lots qui ne contiennent aucune étiquette `heritage-` ajoutée, et la fin dit « 27 clients traités — 27 mis à jour, 0 erreur, 3 ignorés (déjà étiquetés ou absents de Shopify). ».
- [ ] **Step 2: Code.**
  - `etiquettesDeProvenance` : `null` sans client ou si une étiquette commence par `source:` ; sinon les étiquettes du client (rognées, non vides) + `source:shopify` si `provenance === 'shopify'`, sinon `source:app` et `app-player`, sans doublon, jointes par `', '`. `preparerEtiquetage` : un client par `client` (id), `ignores` = comptes sans étiquettes à poser. `envoyerParLots` : pour chaque lot, `await envoyer(lot)` ; chaque `success: false` → erreur « {email} — {reason ?? 'Erreur inconnue'} » et `erreursCompte += 1` ; `fait` avance de la taille du lot ; un rejet → « Lot {n} — erreur réseau : {message} » et `erreursCompte += lot.length` ; `onProgres` après chaque lot ; pause `pauseMs` entre deux lots (le seau GraphQL de Shopify se remplit).
  - `Synchro.tsx` — modèle « réglages » : `EnTeteDePage surtitre="Fragments et boutique" titre="La synchro Shopify" phrase="Relier les comptes d’Explore aux clients de la boutique, et dire à Shopify d’où vient chaque client."` ; **Bloc « Relier les comptes aux clients »** : « Chaque client Shopify est relié au compte qui a son e-mail ; un client sans compte en reçoit un (provenance « shopify »). Rien n’est créé en double. », bouton « Lancer la liaison » (« Liaison en cours… (1 à 2 min) »), le résultat « {shopifyTotal} clients lus — {updated} reliés, {created} comptes créés, {skipped} déjà à jour. » et les journaux en liste ; **Bloc « L’étiquette de provenance »** : « Pose source:app ou source:shopify (et app-player pour les joueurs) sur chaque client relié qui n’a pas encore d’étiquette source:. Ses autres étiquettes ne bougent pas. », bouton « Poser les étiquettes » (« {fait} / {total} clients… » pendant), la fin (`pluriel`) et la liste des erreurs. Les deux actions ne se lancent pas en même temps. Invalider `['hub-comptes']` après la liaison.
  - Route `boutique/synchro`, `ECRANS_FAITS`.
- [ ] **Step 3:** tests, lint, build ; commit `feat(hub-v2): la synchro Shopify — liaison et provenance, sans étiquette de faction`.

---

### Task 11: La santé — Synchro Shopify et fiches publiques

**Files:** `features/accueil/api/sante.ts`, `hooks/useSanteBoutique.ts`, `components/Sante.tsx` (+`Sante.test.tsx`), `components/Ouverture.tsx` ; `.github/workflows/seo-nightly.yml` ; `docs/tech-backlog.md`.

**Interfaces:**
- Consumes : la fonction `shopify-health-check` (GET → `{ ok, status, latency_ms, shop_name?, error?, checked_at }`) par `appelerFonction` / `lireReponse` ; `app_settings` (lecture publique) clé `fiches_publiques_le` (R11).
- Produces : `lireSanteShopify(): Promise<{ ok: boolean; latence: number; erreur: string | null }>` ; `lireFichesPubliques(): Promise<string | null>` ; `useSanteBoutique(): { shopify: … | undefined; shopifyErreur: string | null; fiches: string | null | undefined }` (`['hub-sante-shopify']` rafraîchie toutes les 5 min comme l'ancien badge ; `['hub-fiches-publiques']`) ; `Sante({ sante, boutique, maintenant })`.

- [ ] **Step 1: Test (rouge)** — `Sante.test.tsx` : Shopify joignable → point vert, « Boutique joignable · 182 ms » ; Shopify en panne (`ok: false`, erreur « Shopify 401: … ») ou fonction injoignable → point orange et le message ; fiches reconstruites il y a 5 h → vert « Reconstruites il y a 5 h » ; il y a 40 h → orange « Dernière reconstruction il y a 40 h » ; `null` → orange « Jamais relevée » ; tant que la réponse n'est pas arrivée, la ligne n'apparaît pas.
- [ ] **Step 2: Code.** `Sante.tsx` : les deux lignes après « Commandes Shopify » ; seuil `TRENTE_SIX_HEURES` ; l'en-tête `ATTENTION` du fichier dit ce qui reste au backlog (version d'Explore). `Ouverture.tsx` passe `boutique={useSanteBoutique()}`.
- [ ] **Step 3: Le workflow note la reconstruction** — à la fin de `.github/workflows/seo-nightly.yml`, après « Deploy to Netlify » :

```yaml
      # Le Hub lit cette date dans « La santé » (spec Hub V2 §9) : sans elle, une nuit ratée ne se voit nulle part.
      - name: Note the rebuild for the Hub
        run: |
          curl -sf -X POST "$SUPABASE_URL/rest/v1/app_settings?on_conflict=key" \
            -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
            -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates" \
            -d "{\"key\":\"fiches_publiques_le\",\"value\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

  (Les deux secrets existent déjà pour les étapes précédentes. Le workflow planifié ne tourne que depuis `main` : la ligne restera « Jamais relevée » jusqu'à la fusion — dit dans le rapport.)
- [ ] **Step 4:** `docs/tech-backlog.md`, ligne « Hub V2 — santé » : remplacer par « **Hub V2 — santé** : la version d'Explore (`app_settings.explore.version`) dans « La santé » ; la santé des fiches publiques ne voit pas un déploiement réussi mais vide ». Tests, lint, build ; commit `feat(hub-v2): la santé — Synchro Shopify et fiches publiques`.

---

### Task 12: Préparation en ligne

- [ ] `cd apps/hub-v2 && pnpm test && pnpm lint && pnpm build` ; et `pnpm --filter hub build` (l'ancien Hub n'a pas bougé, il construit toujours).
- [ ] **Par le contrôleur** : la 520 appliquée (accord d'Uriel), types régénérés (`pnpm --filter hub-v2 gen:types`, les signatures écrites à la main disparaissent sous les vraies), puis le déploiement de la Task 2 Step 6 (avec `--functions`). `curl` 200 sur `/boutique/fragments`, `/boutique/fragments/correspondance`, `/boutique/fragments/achats`, `/boutique/photos`, `/boutique/synchro`, `/boutique/audio`, `/communaute/comptes/nouveau`.
- [ ] Parcours dans le navigateur à 1440 et 390 px, sur `https://rdc-hub-v2.netlify.app` : Fragments (la liste ; « Synchroniser » **non lancé** sauf accord d'Uriel — il réécrit les Fragments depuis Shopify ; une fiche ; la carte ; « Enregistrer » sans rien changer) ; Correspondance (lecture) ; Achats (lecture) ; Photos et avis (la file, une contribution, la recherche d'un produit) ; Écoutes (les trois relevés se remplissent) ; Synchro (**aucune action** sans accord d'Uriel : la liaison crée des comptes, l'étiquetage écrit dans Shopify) ; la santé de l'accueil (Synchro Shopify verte). Toute écriture réelle (valider une contribution, associer un Fragment, poser une étiquette) attend l'accord d'Uriel. Console sans erreur.
- [ ] `docs/tech-backlog.md` sous « Hub V2 » : « **Hub V2 — boutique** : Photos et avis : filtres par rôle et par étiquette, suppression d'une étiquette, Missions V1 non repris (R7) » ; « **Hub V2 — boutique** : Fragments en attente pour un e-mail sans compte non repris (le compte du stand le remplace) » ; « **Hub V2 — boutique** : à la bascule (plan 5), repointer le webhook `orders/paid` vers le nouveau site et vérifier `SHOPIFY_WEBHOOK_SECRET` (la copie refuse toute requête sans signature) ». Dans le `CLAUDE.md` racine, section « Repo voisin », `get_fragment_unlocks_by_product` → `get_fragment_unlocks_by_tag`. Commit `docs(hub): le reste du plan 4`.

---

## Self-Review (fait à l'écriture)

- **Couverture** : §11 Fragments Shopify et scans → Tasks 3-4 ; correspondance Shopify → Task 5 ; association à la main (fiche d'un compte, backlog du plan 2) → Task 6 (+ achats à associer, §9, Task 5) ; Photos et avis (596:1319) → Tasks 7-8 ; Écoutes audio → Task 9 ; Synchro Shopify (lien compte-client, provenance, sans faction) → Task 10 ; §12.5 fonctions Netlify → Task 2 ; §9 santé Synchro Shopify et fiches publiques (backlog « Hub V2 — santé ») → Task 11 ; §13.4 → R11. Hors plan, noté : la version d'Explore dans la santé (backlog) ; le webhook (plan 5).
- **Noms** : `hub_contributions`, `hub_achats`, `hub_associer_achat`, `hub_classer_achat`, `hub_associer_fragment`, `hub_retirer_fragment`, `hub_comptes_clients` ; `appelerFonction`, `lireReponse`, `graphqlShopify`, `lireIllustrations`, `lireInventaireAudio`, `lireProduitsSansIllustration`, `chercherProduits`, `pousserImage`, `retirerImage`, `lireClientsShopify`, `pageSuivante` ; clés `hub-fragments`, `hub-scans`, `hub-illustrations`, `hub-cultures-fragments`, `hub-achats`, `hub-correspondances`, `hub-contributions`, `hub-ecoutes`, `hub-sante-shopify`, `hub-fiches-publiques`, plus `hub-ouverture`, `hub-compte`, `hub-comptes` des plans 1-2.
- **Review Focus** : 1 → Task 2 ; 2 → Task 8 ; 3 → Task 5 ; 4 → Task 5 + SQL Task 1 ; 5 → Task 9.

## À trancher par Uriel

1. **« Média », le quatrième canal d'une photo** dans la maquette : par défaut, l'accord de diffusion de la contribution (`consent_brand_usage`), en lecture seule. Autre sens ?
2. **Les quatre chiffres de Photos et avis** (règle du §8 : une définition validée avant d'être codée) : proposés « À valider », « Publiées », « Archivées » (nombre de contributions par statut), « Photos au mur » (photos avec `show_on_wall`).
3. **« Achats à associer » compte aussi les `pending`** (94 le 14/10), qui se règlent seuls à l'inscription : garder la définition du §9, ou ne compter que les `no_match` (35) dans la pastille ?
4. **Les trois trous des fonctions** (R2) sont aussi sur l'ancien site, en service : les refermer là-bas tout de suite (hors plan, un déploiement de l'ancien Hub), ou attendre la bascule ?
5. **Hors plan, relevé en écrivant** : `app_settings` est lisible par n'importe qui (politique `app_settings_read`, `anon` compris) et contient `resend_api_key`, `vapid_private_key`, `email_trigger_secret`, `push_trigger_secret`. À fermer vite, dans une migration à part.
