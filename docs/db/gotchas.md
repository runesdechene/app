# Gotchas BDD

> Pièges récurrents Supabase / PostgreSQL. Lecture obligatoire avant d'écrire une migration ou une RPC.

---

## API Supabase JS (côté frontend)

### Select `.single()` ne throw pas

`supabase.from(...).select().single()` retourne `{ data: null, error: {...} }` en cas d'échec — **jamais d'exception**. Le `try/catch` ne déclenche pas.

```ts
const { data, error } = await supabase.from('places').select('*').eq('id', id).single()
if (error) {
  console.error('places.single error:', error)
  return null
}
```

Le `try/catch` ne sert qu'aux erreurs **réseau** (connexion perdue, timeout).

### RPC : toujours destructurer `{ data, error }`

Sans destructurer, le vrai message d'erreur Postgres est invisible — code continue avec `data = undefined`.

```ts
const { data, error } = await supabase.rpc('my_function', { arg })
if (error) {
  console.error('RPC my_function error:', error.message, error.details, error.hint)
  throw error
}
```

`error.details` et `error.hint` contiennent souvent l'info clé (colonne manquante, contrainte violée).

### Convention de retour : chaque RPC a son shape

**Ne jamais présumer.** Lire la migration qui définit la RPC et vérifier le JSON retourné. Exemples : certaines retournent `{ ok: true }`, d'autres `{ success: true }`, d'autres `{ error: '...' }` ou un objet métier direct.

---

## Schema PostgreSQL

### Schema DB — noms de colonnes (pièges récurrents)

Avant d'écrire une query : **vérifier le schema** dans `001_baseline_2026-04-22.sql` ou via le graph SQL (`graphify-out/graph.json`). Ne jamais deviner.

#### Table `places`
- ✅ `author_id` (PAS `created_by`)
- ❌ Pas de colonne `views` — utiliser `COUNT` sur `places_viewed`
- ✅ `images` en JSONB : `[{id, url, thumb?}]`

#### Table `places_bookmarked`
- ✅ Nom de la table = `places_bookmarked` (PAS `bookmarks`)

#### Table `users` (public)
- ✅ `first_name`, `display_name`
- ❌ Pas de `last_name` depuis migration 076
- ✅ `email_address` (PAS `email` — voir `auth.md`)
- ✅ `avatar_url` prioritaire sur legacy `image_media`

#### Table `activity_log`
Colonnes : `type`, `actor_id`, `place_id`, `faction_id`, `data`.
- ❌ PAS de `user_id` (c'est `actor_id`)
- ❌ PAS de `action` (c'est `type`)

### `anchorPlaceId` migre après fusion de blob

`anchorPlaceId` = lieu avec le meilleur score dans un blob de conquête. Lors d'une fusion, l'anchor change (celui du blob dominant gagne). Les **propositions de noms** liées à l'ancien anchor doivent migrer vers le nouveau, sinon elles disparaissent ou se retrouvent associées au mauvais blob.

Vérifier dans `territoryWorker.ts` (`collectBlobStats()`, `addTerritory()`).

---

## Functions / RPCs

### `STABLE` ignore les `UPDATE` silencieusement

Une fonction Postgres `STABLE` ne peut pas modifier la base. Tout `UPDATE`/`INSERT` à l'intérieur est **ignoré sans erreur**. Pour toute fonction qui modifie : laisser **VOLATILE** (défaut, ne rien spécifier).

```sql
-- ❌ MAUVAIS — UPDATE silencieusement ignoré
CREATE OR REPLACE FUNCTION bump_score(...) STABLE AS $$ ... UPDATE ... $$;

-- ✅ BON — VOLATILE par défaut
CREATE OR REPLACE FUNCTION bump_score(...) AS $$ ... UPDATE ... $$;
```

### Lire avant de réécrire — procédure obligatoire

**Reconstruire au lieu de copier = régressions silencieuses.** Le cerveau se concentre sur le changement voulu et oublie le reste.

Exemples de régressions passées :
- `get_place_by_id` réécrit en inventant `v_place.description`, `v_place.score`, `unnest(v_place.images)` qui n'existaient pas (29 mars 2026) — 3 erreurs en cascade
- `place_influence_action` mig 196 a écrasé la suppression de la limite remote (mig 051), réintroduisant un cap de 5 pts/jour (régression silencieuse)
- `get_user_titles` réécrit 3 fois (mig 182, 191, 193) sans `unlocks` → bouton "Ajouter un lieu" grisé pour tous
- `invest_crowns` redéfinie **10 fois** (079→094→095→097→119→133→138→150→152→164). XO a failli repartir de la **150** parce que son nom (`preserve_invests_on_basculement`) *sonnait* abouti, alors que **152** (refonte user-centric) et **164** (baseline courante) la suivaient (24 mai 2026). Rattrapé uniquement par le domaine d'Uriel.

> **⚠️ "La plus récente" = le plus HAUT NUMÉRO de migration, jamais le nom de fichier qui sonne le plus définitif.** Une fonction critique peut être redéfinie 10×. Le nom (`_fix_`, `_polish_`, `_preserve_`) ne dit rien de l'ordre. Trier numériquement et lire la dernière — point.

**Procédure** :
1. **Récupérer la définition LIVE** — source de vérité unique, à l'épreuve du "mauvais fichier choisi" :
   ```sql
   select pg_get_functiondef('public.nom_fonction(text)'::regprocedure);
   ```
   Les fichiers de migration mentent par omission : une fonction est souvent enrichie par N migrations successives (corps en 192, champ `tag` ajouté en 193…). Repartir d'un vieux fichier fait sauter les enrichissements ultérieurs. Le grep+tri reste un contre-check, PAS la base — l'exemple `invest_crowns` (10 redéfinitions) montre qu'on se trompe de "dernière" en se fiant au nom de fichier.
   ```bash
   grep -rn "CREATE OR REPLACE FUNCTION public.nom_fonction" supabase/migrations/ | sort -t/ -k3 -n
   ```
2. Copier-coller la def LIVE entière dans la nouvelle migration.
3. Modifier UNIQUEMENT la partie concernée par le changement.
4. Comparer chaque comportement (limites, colonnes retournées, JSON build, RLS) avec la def live d'origine.
5. Vérifier les noms de colonnes contre la structure réelle avant commit.
6. Après apply : re-fetch `pg_get_functiondef` et confirmer que le delta voulu est là ET que rien d'autre n'a sauté.

> **Régression du 4 juin 2026** : `get_defis_board` réécrit depuis le corps de la mig 192 → champ `tag` (icône SVG ajoutée en 193) perdu → défis en emoji au lieu de la pastille custom. Exactement cette classe. La def live l'aurait montré immédiatement.

**Règle absolue** : ne jamais deviner un nom de colonne. Toujours le vérifier.

### `unlocks` toujours dans `get_user_titles`

Quand on réécrit `get_user_titles`, **toujours vérifier** que `'unlocks', t.unlocks` est dans **CHAQUE** `json_build_object` (titres généraux ET titres faction). Le frontend fait `t.unlocks?.includes('add_place')` — sans le champ, retourne toujours `undefined`. Bug silencieux.

```sql
json_build_object(
  'id', t.id,
  'name', t.name,
  'description', t.description,
  'unlocks', t.unlocks,  -- ← NE JAMAIS OUBLIER
  'faction_id', t.faction_id,
  ...
)
```

**Règle générale** : ne jamais retirer un champ du retour d'une RPC sans grep le nom dans `apps/explore-web/` et `apps/hub/`.

---

## Triggers

### `handle_new_user` désaligné avec `users` schema → signups bloqués

Trigger `handle_new_user()` sur `auth.users` fait un `INSERT INTO public.users (...)` avec une **liste de colonnes figée**. Si quelqu'un modifie le schema users (ajoute une colonne `NOT NULL` sans DEFAULT, ou drop un DEFAULT) **sans mettre à jour le trigger**, tous les nouveaux signups plantent avec `Database error saving new user`. Erreur silencieuse côté Supabase Auth.

**Cas réel — avril 2026 (5 jours bloqués)** : `users.rank` historiquement `VARCHAR(255) DEFAULT 'guest'`. Quelqu'un a fait `ALTER COLUMN rank DROP DEFAULT`. Le trigger ELSE branch n'incluait pas `rank` → INSERT rejeté. La DOUBLON branch incluait `COALESCE(v_existing.rank, 'guest')` → fonctionnait. **Symptôme trompeur** : réactivations OK, nouveaux signups KO. Fix : migration 089.

**Diagnostic rapide** :

```sql
-- 1. Lister colonnes NOT NULL sans default
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
  AND is_nullable = 'NO' AND column_default IS NULL;

-- 2. Lire la source du trigger en prod
SELECT pg_get_functiondef(oid) AS source
FROM pg_proc
WHERE proname = 'handle_new_user' AND pronamespace = 'public'::regnamespace;

-- 3. Vérifier l'owner du trigger (doit être postgres → BYPASSRLS)
SELECT proname, proowner::regrole AS owner
FROM pg_proc
WHERE proname = 'handle_new_user' AND pronamespace = 'public'::regnamespace;
```

**Règle à tenir** : toute migration qui modifie `public.users` (ADD COLUMN NOT NULL, DROP DEFAULT, RENAME) doit **explicitement vérifier** que les 3 branches de `handle_new_user` restent cohérentes. Idéalement : ajouter la colonne au trigger INSERT (belt + suspenders) ET garder un DEFAULT sur la colonne (suspenders + belt).

### Backfill — toujours désactiver les triggers

Les triggers `AFTER INSERT` s'exécutent **ligne par ligne** sur un INSERT multi-row. Sur un backfill de milliers de lignes : milliers de side-effects.

**Incident passé** : un backfill a créé 2200 entrées spam dans `activity_log` via un trigger, qui a inondé le système de toasts côté client jusqu'au crash.

```sql
ALTER TABLE activity_log DISABLE TRIGGER USER;  -- avant
INSERT INTO target_table ...;                    -- backfill
ALTER TABLE activity_log ENABLE TRIGGER USER;   -- après
```

**Règle** : avant tout INSERT > 100 lignes, se demander quels triggers vont se déclencher et si leurs effets sont souhaitables à cette échelle.

---

## Storage

### Buckets Supabase Storage — création manuelle uniquement

**Les buckets ne peuvent PAS être créés via migration SQL.** Ils sont créés manuellement dans le dashboard Supabase.

À chaque nouveau bucket dans le code (`.from('nouveau-bucket')`), **signaler explicitement à Uriel** :

> "Crée le bucket `nouveau-bucket` (public/privé) dans le dashboard Supabase."

Préciser : nom exact, public/privé, policies RLS à mettre.

**Buckets existants** :
- `place-images` — public, photos de lieux et avatars
  - Paths : `places/{authorId}/{imageId}.webp` + `_thumb.webp`
  - Avatars : `avatars/{userId}.webp`

Voir `storage.md` pour le détail.

## Données personnelles (RGPD)

### `users` : grants colonne par colonne, plus au niveau table (mig 337)

`anon` et `authenticated` n'ont **plus** de `GRANT SELECT` sur la table `users` :
ils ont une liste blanche de colonnes. `email_address` et `password` en sont
exclus. Conséquences pratiques :

- **Toute nouvelle colonne de `users` doit être GRANTée explicitement** dans la
  migration qui la crée, sinon le front lira `permission denied for table users` :
  ```sql
  GRANT SELECT (ma_nouvelle_colonne) ON public.users TO anon, authenticated;
  ```
  (Volontairement deny-by-default : on préfère une erreur franche à une fuite.)
- **`select('*')` sur `users` est mort** côté front — l'étoile déplie toutes les
  colonnes, y compris celles interdites. Lister les colonnes, ou passer par la
  vue staff.
- Le back-office lit `public.users_admin`, vue gardée par `_is_staff()`. Les
  écritures continuent d'aller sur `users`.
- L'app identifie le joueur au démarrage via `get_my_user_row()` : elle ne peut
  plus filtrer sur `email_address`.

### Jamais d'email dans un nom affiché (mig 336)

Le nom public d'un joueur vient de `user_public_name(id, display_name, first_name)`
— **jamais** d'un `COALESCE(..., email_address)`. Sans nom, la fonction rend
`Explorateur XXXX`. Origine : 444 comptes affichaient leur adresse comme pseudo.

### Une policy sans clause `TO` s'applique à `anon`

`CREATE POLICY "Service role can manage X" ON x FOR ALL USING (true)` sans `TO
service_role` s'applique à **PUBLIC**, donc à la clé anon publique. C'est comme
ça que `purchase_log` exposait les emails des acheteurs. Toujours écrire le `TO`.

### Une policy ne lit pas `users` en direct

Un `EXISTS (SELECT 1 FROM users WHERE ...)` inline dans une policy est évalué
avec les droits de l'appelant : pour `anon`, qui n'a plus accès à `users`, ça ne
renvoie pas « faux », ça **plante** la requête. Utiliser `_is_staff()` /
`_is_admin()`, qui sont `SECURITY DEFINER`.
