# Auth & utilisateurs

> Modèle auth Supabase + table métier `public.users`. À lire avant de toucher au flow d'auth, à un fetch utilisateur ou à une RLS users.

## Le piège central

`auth.users` (Supabase Auth) et `public.users` sont **deux tables séparées**. Le lien se fait par **email** (`auth.users.email` ↔ `public.users.email_address`), **pas par id**.

Les `id` de `public.users` sont des `VARCHAR` (legacy) qui ne correspondent **PAS** aux UUID d'`auth.users`.

```ts
// ❌ MAUVAIS — pas de match (id legacy ≠ UUID auth)
await supabase.from('users').select('role').eq('id', authUser.id).single()

// ✅ BON — match par email
await supabase.from('users').select('role').eq('email_address', authUser.email).single()
```

## Composants

### `auth.users` (Supabase Auth)
UUID, `email`, métadonnées d'authentification, gérée par Supabase.

### `public.users` (table métier)
- `id` VARCHAR (legacy)
- `email_address`
- `first_name`, `display_name`
- `avatar_url`
- `role` — `'user'` / `'ambassador'` / `'moderator'` / `'admin'`
- `faction_id`
- `account_source` — `'app'` ou `'shopify'` uniquement (immuable, voir Bible Game Design)

## Mismatch `userData.id ≠ auth.uid()`

Au boot de l'app, `usePlayer` charge le profil utilisateur. Pour les users créés avant la migration vers le système auth-id, `userData.id` (VARCHAR legacy) ne correspond pas à `auth.uid()` (UUID Supabase Auth). Comportement erratique, RLS qui échoue silencieusement.

Le lien par email **masque ce mismatch** tant qu'on ne fait pas d'opération qui dépend de `auth.uid()` directement.

**Fix au boot** :

```ts
if (userData.id !== auth.uid()) {
  await supabase.rpc('migrate_user_to_auth_id')
  // re-fetch userData
}
```

## RLS et silent-deny — règle critique (incident avril 2026)

`public.users` avait RLS ENABLE avec policies `SELECT` + `INSERT` seulement, **pas d'`UPDATE`** → Postgres deny silencieux (0 ligne, pas d'erreur). `markTutorialComplete` posait `tutorial_completed_at` côté client via `.from('users').update()` qui n'écrivait **jamais** en DB. Le store local était set optimistement → session OK, reload → `NULL` → tuto rejoué.

**Solution convention** (voir `apps/explore-web/CLAUDE.md`) : **toute mutation sur `public.users` passe par une RPC `SECURITY DEFINER`** avec check `auth.uid()`, pas un `.from('users').update()` direct.

Migration 004 a posé deux RPCs sur ce pattern :
- `mark_tutorial_complete(p_user_id)` — pose `tutorial_completed_at`
- `touch_last_login(p_user_id)` — pose `last_login_at`

**Règle générale** : si une mutation utilisateur ne s'écrit pas alors qu'elle devrait, vérifier d'abord qu'il y a bien une policy RLS pour ce verbe (`UPDATE`/`DELETE`), pas juste `SELECT`/`INSERT`. À défaut, créer une RPC SECURITY DEFINER.

## Onboarding nouveau joueur

Détection : `userName === '' && userFactionId === null`.

## Flow Hub — fetch role

Le Hub utilise `fetchRole` (chercher via Graphify, cluster auth) qui fait `.eq('email_address', authUser.email)`.
