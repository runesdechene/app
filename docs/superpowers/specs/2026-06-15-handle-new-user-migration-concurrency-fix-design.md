# Fix concurrence migration Shopify → app (`handle_new_user`) — Design

> Date : 2026-06-15
> Zone : Supabase (trigger `auth.users` → `public.handle_new_user`)
> Statut : validé (design), prêt pour plan d'implémentation

## Contexte & problème

Des utilisateurs venant de Shopify n'arrivent pas à se connecter à l'app sur
mobile : ils voient un **« unexpected error »**. Cas déclencheur :
`nathalie1937@yahoo.fr` (client Shopify `shopify-8526091616523`).

### Diagnostic (mené le 2026-06-15)

- Aucun compte `auth.users` pour elle, mais un profil legacy dans `public.users`
  (`id = shopify-8526091616523`, `account_source = 'shopify'`, créé le
  2024-12-12, jamais connecté).
- L'app (`apps/explore-web/src/hooks/useAuthForm.ts`) utilise un **OTP email à
  6 chiffres** (`signInWithOtp` → `verifyOtp`). En cas d'échec à l'étape
  `requestCode`, elle affiche **le message brut de Supabase**
  (`setError(err.message)`). Le « unexpected error » est donc l'erreur GoTrue
  affichée telle quelle, pas un message de l'app.
- À chaque création de compte, le trigger `on_auth_user_created` exécute
  `public.handle_new_user`, qui **migre** le profil legacy vers le nouveau
  compte : il vide `email_address` + `shopify_customer_id` de l'ancienne ligne,
  **INSÈRE une nouvelle ligne** (id = UUID auth) en **recopiant
  `shopify_customer_id`**, **redirige les 61 FK** pointant sur `users.id`, puis
  **supprime** l'ancienne ligne. Le tout dans la transaction de création GoTrue.
- **Logs Postgres** : erreur récurrente (plusieurs fois/heure) :
  `duplicate key value violates unique constraint "idx_users_shopify_customer_id"`
  (`CREATE UNIQUE INDEX ... ON public.users (shopify_customer_id) WHERE shopify_customer_id IS NOT NULL`).
- Preuves de concurrence : une **simulation séquentielle** de la migration
  (transaction `ROLLBACK`) a réussi sans erreur, et **une requête OTP réelle
  unique** pour son email a réussi (HTTP 200) — créant et migrant proprement son
  compte (`auth.users 855154e4-fc02-4847-bc97-04fea50c89e0`). La prod échoue donc
  uniquement **sous concurrence**, pas par bug logique ni timeout.

### Cause racine

Deux requêtes de connexion quasi simultanées pour le **même email** (double-tap /
retry réseau, typique mobile) passent toutes deux dans `handle_new_user`, lisent
la même ligne legacy et insèrent chacune une nouvelle ligne portant le **même
`shopify_customer_id`** → violation de l'index unique → **toute la transaction
GoTrue est annulée** (donc aucun `auth.users` créé) → « unexpected error ». Le
bloc `EXCEPTION` existant ne sauve pas le cas car la violation casse la
transaction de création.

### Impact

- Pas un cas isolé : **1 348 profils Shopify legacy** (`id LIKE 'shopify-%'`)
  restent non migrés et se heurteront au même mur à leur première connexion.
- Taux d'activation des comptes Shopify : **24 migrés / 1 372** (~1,7 %).

### État des données (pas de réparation nécessaire)

- **0** ligne placeholder `__migrated_%` (le fallback `EXCEPTION` n'a jamais
  persisté de dégât — la transaction est tout-ou-rien).
- **0** doublon de `shopify_customer_id`.
- 3 formats d'`id` coexistent dans `public.users` :
  - UUID → comptes Supabase-auth (format cible),
  - `shopify-<digits>` → imports Shopify legacy,
  - nanoid (ex. `d3Hanbxl5N0DCE97ROSZF`) → vieux comptes app legacy.

## Décision retenue

**Approche A — verrou de concurrence + garde d'idempotence**, choisie pour son
risque minimal (garde l'architecture actuelle, change uniquement la fonction).

Rejetées :
- **B (renommage d'id in-place + `ON UPDATE CASCADE`)** : exigerait que les 61 FK
  soient en `ON UPDATE CASCADE` — migration lourde et risquée.
- **C (sortir la migration de la transaction d'auth, migration post-login via RPC
  dédiée)** : plus robuste à terme, mais refonte plus grosse. **Notée comme
  évolution future** si on veut alléger durablement la transaction d'auth.

## Design — `handle_new_user` durci

La garde de migration se base sur **« l'id existant n'est pas un UUID »**
(= ligne legacy, quelle que soit son origine : shopify, stand, ancien nanoid app),
et **non** sur `account_source`.

Logique cible :

```text
-- 1. Sérialiser par email : tue la race de double-tap.
PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || lower(coalesce(NEW.email, ''))));

-- 2. Verrouiller la ligne existante éventuelle.
SELECT * INTO v_existing
FROM public.users
WHERE lower(email_address) = lower(coalesce(NEW.email, ''))
LIMIT 1
FOR UPDATE;

-- 3. Brancher selon l'état.
IF v_existing.id IS NULL THEN
    → créer une ligne app fraîche (branche ELSE actuelle : energy/max_energy depuis app_settings, account_source 'app')
ELSIF v_existing.id = NEW.id::text THEN
    → NULL  -- déjà présent/migré : idempotent, ne rien faire
ELSIF v_existing.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    → MIGRER (logique actuelle inchangée : null email/shopify_id ancienne ligne,
              INSERT nouvelle ligne, repoint dynamique des 61 FK, DELETE ancienne)
ELSE
    → NULL  -- cas improbable (autre UUID, même email) : ne rien faire de destructif
END IF;
```

**Pourquoi ça corrige le bug** : `pg_advisory_xact_lock` (clé dérivée de l'email)
sérialise deux exécutions concurrentes. La 1ʳᵉ migre et commit ; la 2ᵉ, débloquée,
retrouve la ligne désormais en UUID → branche `NULL` → **plus aucun double INSERT
de `shopify_customer_id`**. `FOR UPDATE` renforce le verrouillage de la ligne.

**Bloc `EXCEPTION`** : conservé tel quel. Le fallback insère une ligne minimale
avec `email_address = '__migrated_' || NEW.id` (donc unique) et **ne touche pas
`shopify_customer_id`** → il ne peut plus re-violer l'index. Il devient un vrai
dernier recours, désormais quasi jamais atteint.

**La logique interne de migration (INSERT/SELECT, boucle FK, DELETE) reste
identique** — on n'y touche pas ; on l'enveloppe seulement de garde + verrou.

## Tests (scripts SQL, en transaction `ROLLBACK`)

1. **Migration legacy** : un profil `shopify-*` migre → une seule ligne en UUID,
   `shopify_customer_id` préservé, FK repointées, ancienne ligne supprimée.
2. **Idempotence** : rejouer la migration pour la même ligne → 2ᵉ passage = no-op
   (branche `v_existing.id = NEW.id` ou ligne déjà UUID), aucun doublon.
3. **Régression nouvel email** : email sans ligne legacy → création d'une ligne
   app fraîche (`account_source 'app'`, energy par défaut).
4. **Garde anti double-migration** : ligne déjà en UUID ≠ NEW.id → branche `NULL`,
   pas de migration destructive.

> Note : la race réelle (deux transactions GoTrue concurrentes) est difficile à
> reproduire déterministiquement en SQL pur. Les tests valident la **garde** et
> l'**idempotence** ; le `pg_advisory_xact_lock` est la garantie structurelle de
> sérialisation (comportement Postgres connu, pas re-testé unitairement).

## Hors-scope

- **Réparation de données** : aucune (base saine — 0 placeholder, 0 doublon).
- **Approche C** (migration post-login) : évolution future, pas maintenant.
- **Front** : amélioration du message d'erreur dans `useAuthForm.ts` (afficher un
  texte FR clair au lieu de l'erreur brute anglaise) — **traitée séparément**, pas
  dans cette migration.
- Les 1 348 profils legacy ne sont **pas** migrés en masse de façon proactive :
  ils se migreront proprement à leur première connexion une fois le trigger
  corrigé (comportement souhaité, charge étalée).

## Fichiers impactés (prévisionnel)

- **Migration** `supabase/migrations/257_*.sql` (prochaine dispo ; dernière =
  `256_user_crowns_drop_500_cap.sql`) :
  `CREATE OR REPLACE FUNCTION public.handle_new_user()` avec verrou advisory +
  `FOR UPDATE` + garde d'idempotence basée sur le format d'id. Pas de changement
  de signature, pas de recréation du trigger.

## Critères d'acceptation

1. Une migration de profil Shopify legacy aboutit (ligne UUID unique, FK
   repointées, ancienne supprimée).
2. Deux exécutions de `handle_new_user` pour le même email **ne produisent plus**
   de violation `idx_users_shopify_customer_id` (sérialisées par le verrou).
3. Rejouer la fonction sur un profil déjà migré est un no-op (idempotent).
4. Un nouvel email sans legacy crée toujours une ligne app fraîche (non-régression).
5. La migration est idempotente côté fichier (`CREATE OR REPLACE`) et n'altère pas
   le trigger `on_auth_user_created`.
6. Les logs Postgres ne montrent plus l'erreur `duplicate key ...
   idx_users_shopify_customer_id` après déploiement (vérification post-deploy).
