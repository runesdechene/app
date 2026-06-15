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

**Deux chemins exécutent la même migration legacy → auth UUID sans
coordination :**

1. le **trigger** `handle_new_user` (à la création `auth.users`, pendant le signup) ;
2. la **RPC** `migrate_user_to_auth_id` (appelée par le front
   `apps/explore-web/src/hooks/usePlayer.ts:72` **au login**, quand l'id en base
   ≠ `auth.uid()`).

Les deux vident l'email + `shopify_customer_id` de l'ancienne ligne, **insèrent
une nouvelle ligne en recopiant `shopify_customer_id`**, redirigent les FK et
suppriment l'ancienne. En concurrence (signup + login, double-tap, retry réseau),
ils insèrent le **même `shopify_customer_id`** → violation de l'index unique
partiel → **toute la transaction est annulée** (donc aucun `auth.users` créé) →
« unexpected error ». Le bloc `EXCEPTION` existant ne sauve pas le cas car la
violation casse la transaction. La race est principalement **trigger ↔ RPC**, pas
seulement trigger ↔ trigger.

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
- ⚠️ **~1218 lignes legacy ont un id de forme UUID mais SANS `auth.users`**
  correspondant (`account_source = 'app'`, dont 1210 avec `shopify_customer_id`).
  → Une garde « ne migrer que si l'id existant n'est pas un UUID » les laisserait
  **sans profil** à leur prochaine connexion. La garde basée sur le format d'id
  est donc **écartée** (cf. Décision retenue).

## Décision retenue

**Approche A (révisée) — verrou advisory partagé sur les DEUX chemins de
migration, sans garde par format d'id.** Choisie pour son risque minimal (garde
l'architecture actuelle) tout en couvrant la vraie race (trigger ↔ RPC).

Évolution vs la 1ʳᵉ version d'Approche A (revue de code) :
- **La garde par format d'id (UUID vs legacy) est abandonnée** : ~1218 lignes
  legacy ont un id UUID sans `auth.users` ; une garde « skip si UUID » les
  casserait. La condition d'origine `v_existing.id <> NEW.id::TEXT` suffit à
  l'idempotence (déjà migré vers cet id → no-op via `ON CONFLICT DO NOTHING`).
- **La RPC `migrate_user_to_auth_id` reçoit le MÊME verrou** : sinon la race
  trigger ↔ RPC persiste (c'est le chemin le plus réaliste en prod).

Rejetées :
- **B (renommage d'id in-place + `ON UPDATE CASCADE`)** : exigerait que les 61 FK
  soient en `ON UPDATE CASCADE` — migration lourde et risquée.
- **C (sortir la migration de la transaction d'auth, migration post-login)** :
  plus robuste à terme mais refonte bien plus grosse (trigger allégé + RPC/queue
  idempotente + fiabilisation front + gestion de la fenêtre « loggé mais pas
  encore migré » où la RLS `auth.uid() = users.id` ne voit aucun profil). Le bug
  actuel étant une **race** (pas un timeout), C n'apporte rien de plus ici.
  **Notée comme évolution future** si la migration intra-transaction pose un jour
  des soucis de latence.

## Design — verrou advisory partagé

Clé de verrou commune : `hashtext('handle_new_user:' || lower(email))`.

**1) Trigger `handle_new_user`** (logique d'origine + verrou) :

```text
PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || lower(coalesce(NEW.email, ''))));
SELECT * INTO v_existing FROM public.users
  WHERE lower(email_address) = lower(coalesce(NEW.email, '')) LIMIT 1 FOR UPDATE;

IF v_existing.id IS NOT NULL AND v_existing.id <> NEW.id::TEXT THEN
    → MIGRER (logique inchangée : null email/shopify_id ancienne ligne,
              INSERT nouvelle ligne, repoint dynamique des 61 FK, DELETE ancienne ;
              bloc EXCEPTION fallback inchangé)
ELSE
    → créer une ligne app fraîche (energy depuis app_settings, account_source 'app',
      ON CONFLICT (id) DO NOTHING → no-op si déjà à NEW.id)
END IF;
```

**2) RPC `migrate_user_to_auth_id`** (logique d'origine + même verrou + re-check) :

```text
IF auth.uid()::TEXT != p_new_id THEN RETURN 'unauthorized'; END IF;
SELECT email_address INTO v_email FROM public.users WHERE id = p_old_id;
IF v_email IS NULL THEN RETURN 'old_user_not_found'; END IF;

PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || lower(coalesce(v_email, ''))));

-- Le trigger a pu migrer (et supprimer) l'ancienne ligne pendant l'attente :
PERFORM 1 FROM public.users WHERE id = p_old_id;
IF NOT FOUND THEN RETURN {success, note: 'already_migrated'}; END IF;

→ migration (logique inchangée)
```

**Pourquoi ça corrige le bug** : trigger et RPC prennent le même verrou
transaction-level par email → **mutuellement exclusifs**. Le 2ᵉ arrivant attend
le commit du 1ᵉʳ, re-vérifie l'état, et fait un no-op si la migration est déjà
faite → **plus aucun double INSERT de `shopify_customer_id`**, quel que soit le
couple de chemins (trigger↔trigger, trigger↔RPC, RPC↔RPC). Un seul verrou par
email → pas de risque de deadlock.

**Bloc `EXCEPTION`** (les deux fonctions) : conservé tel quel. Les fallback ne
touchent pas `shopify_customer_id` → ne peuvent pas re-violer l'index.

## Tests (scripts SQL, en transaction `ROLLBACK`)

1. **Migration legacy (trigger)** : insertion `auth.users` pour un email lié à un
   profil `shopify-*` → une seule ligne en UUID, `shopify_customer_id` préservé,
   FK repointées, ancienne ligne supprimée.
2. **Régression nouvel email (trigger)** : email sans ligne legacy → création
   d'une ligne app fraîche (`account_source 'app'`, energy par défaut).
3. **Idempotence (trigger)** : ligne déjà présente à `NEW.id` → no-op, pas de
   doublon.
4. **RPC migration** : avec `request.jwt.claims.sub = p_new_id` (pour
   `auth.uid()`), migration d'un profil legacy → ligne UUID, ancienne supprimée.
5. **RPC après trigger (no-op)** : si l'ancienne ligne a déjà été migrée, la RPC
   renvoie `already_migrated` sans erreur.

> Note : la race réelle (deux transactions concurrentes) n'est pas reproductible
> déterministiquement en session SQL unique. Les tests valident migration,
> idempotence et le re-check de la RPC ; `pg_advisory_xact_lock` est la garantie
> structurelle de sérialisation (comportement Postgres connu).

## Hors-scope

- **Réparation de données** : aucune (base saine — 0 placeholder, 0 doublon).
  Les ~1218 lignes legacy à id UUID restent telles quelles ; elles se migreront
  correctement à leur prochaine connexion (la RPC sans garde de format les gère).
- **Approche C** (migration post-login) : évolution future, pas maintenant.
- **Front** : amélioration du message d'erreur dans `useAuthForm.ts` (texte FR au
  lieu de l'erreur brute anglaise) — **traitée séparément**.
- Pas de migration de masse proactive des profils legacy : charge étalée à la
  connexion.

## Fichiers impactés (prévisionnel)

- **Migration** `supabase/migrations/257_handle_new_user_concurrency_guard.sql`
  (dernière = `256_user_crowns_drop_500_cap.sql`) :
  `CREATE OR REPLACE` des DEUX fonctions `public.handle_new_user()` et
  `public.migrate_user_to_auth_id(text, text)` avec le verrou advisory partagé.
  Pas de changement de signature, pas de recréation du trigger `on_auth_user_created`.

## Critères d'acceptation

1. Une migration de profil Shopify legacy aboutit via le trigger (ligne UUID
   unique, FK repointées, ancienne supprimée).
2. Le trigger ET la RPC prennent le même verrou advisory par email → plus de
   violation `idx_users_shopify_customer_id` en concurrence.
3. Rejouer le trigger sur un profil déjà migré est un no-op ; la RPC sur une
   ligne déjà migrée renvoie `already_migrated`.
4. Un nouvel email sans legacy crée toujours une ligne app fraîche (non-régression).
5. Aucune garde par format d'id (les ~1218 lignes UUID legacy restent migrables).
6. La migration est idempotente côté fichier (`CREATE OR REPLACE`) et n'altère pas
   le trigger `on_auth_user_created`.
7. Les logs Postgres ne montrent plus l'erreur `duplicate key ...
   idx_users_shopify_customer_id` après déploiement (vérification post-deploy).
