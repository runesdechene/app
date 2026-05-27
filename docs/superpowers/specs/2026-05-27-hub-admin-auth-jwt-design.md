# Hub — Auth admin : rôle dans le JWT (app_metadata) — Design

> Spec de vision/design. Date : 2026-05-27.
> Objet : éradiquer le bug récurrent « User not admin » (faux refus, contournable seulement en
> navigation privée) en faisant porter le rôle admin par le **JWT** au lieu d'une requête DB
> côté client fragile.

---

## 1. Problème (cause racine établie)

Le hub gate l'admin via `useAuth.fetchRole()` : une requête `select role from users where email=…`
exécutée côté client. Cette requête **échoue/pend de façon intermittente** (notamment deadlock
quand elle est `await`ée dans le callback `onAuthStateChange`, ou autre transitoire), et
`fetchRole` traduit *tout* échec en `role = null` → faux « Accès refusé ». Vidange du localStorage /
navigation privée contournent — d'où un bug récurrent et énervant.

Vérifié : côté base, les comptes admin sont **irréprochables** (`contact@runesdechene.com` : 1 ligne,
`role=admin`, `auth.users.id == public.users.id`, GRANT SELECT OK, RLS `USING(true)`). Le défaut est
**100 % dans la résolution du rôle côté client**. Tant qu'on gate via une requête réseau qui peut
échouer, on reste exposé à cette classe de bug.

> Note : une tentative de « différer hors du callback » a déjà été déployée puis **revertée** (elle
> cassait le chargement et n'adressait pas la classe). On change donc d'**architecture**, on ne
> rapièce plus.

## 2. Décisions

### D1 — Le rôle voyage dans le JWT via `app_metadata` (validé)
`auth.users.raw_app_meta_data.user_role = 'admin'` pour les admins. `app_metadata` est **géré côté
auth** (non modifiable par l'utilisateur → sûr), **inclus automatiquement** par Supabase dans le JWT,
et exposé sur `session.user.app_metadata`. Le client lit le rôle **de façon synchrone depuis la
session** — aucune requête DB de gating.
Choisi plutôt que le *Custom Access Token Hook* (canonique mais nécessite d'activer un hook côté
config Auth) : plus simple, zéro config hook, suffisant pour ~5 admins.

### D2 — Anti-dérive : trigger `public.users.role` → `app_metadata` (validé)
`public.users.role` **reste la source de vérité opérationnelle** (déjà utilisée : édition du rôle dans
`Users.tsx`, sync des tags Shopify…). Un **trigger** sur `public.users` (AFTER INSERT OR UPDATE OF
`role`) propage `role` vers `auth.users.raw_app_meta_data.user_role` (fonction `SECURITY DEFINER`,
match `auth.users.id = NEW.id` — vrai pour tous les admins réels). Nommer/retirer un admin se fait
comme aujourd'hui ; `app_metadata` suit tout seul → **aucune sync manuelle, aucune dérive**.
Backfill une fois pour les 5 admins actuels.

### D3 — `useAuth` : gating synchrone, zéro async dans le callback (validé)
- `isAdmin = session?.user?.app_metadata?.user_role === 'admin'` — **synchrone, aucun `await`, aucune
  requête** dans `onAuthStateChange`. C'est la cause exacte des deux symptômes (faux « pas admin » ET
  l'écran « Chargement… » infini de la tentative revertée) → on l'élimine.
- **Transition sans lock-out** : les tokens déjà émis n'ont pas encore le claim. Au chargement, si une
  session existe mais que `app_metadata.user_role` est absent → **un seul `supabase.auth.refreshSession()`**
  (exécuté **hors** du callback `onAuthStateChange`, dans le chemin `getSession`) pour obtenir un token
  frais porteur du claim, puis relecture. `loading` se résout toujours.

### D4 — Nettoyage de l'ancien système (validé, après vérif)
Une fois le gating app_metadata **vérifié en prod**, **supprimer `fetchRole` et toute lecture de rôle
par requête DB** du chemin d'auth. Pas de fallback DB résiduel. La colonne `public.users.role`
**reste** (source de vérité, trigger + usages métier).

### D5 — Rollout sûr (validé)
Ordre : (1) migration (trigger + backfill du claim) → (2) déploiement du client. Au prochain
chargement, la session admin se rafraîchit → token avec `user_role:admin` → accès **sans incognito**.
Vérification en prod avec Uriel juste après. **explore-web non impacté** : le claim est additif et
l'app ne gate pas dessus.

## 3. Hors-périmètre
- Custom Access Token Hook (mécanisme écarté au profit d'app_metadata).
- RBAC complet / table de permissions (un seul rôle admin suffit ici).
- Comptes à id non-aligné (Firebase legacy, ex. `lahoussaye.ouriel@gmail.com`) : pas de compte
  `auth.users`, ne peuvent pas se connecter au hub → hors sujet.
- Refonte de `LoginPage` (OTP) : inchangée.

## 4. Critère de succès
Connexion fraîche en `contact@runesdechene.com` → **admin du premier coup, sans navigation privée**,
de façon répétable ; **aucune requête DB** dans le chemin de gating ; aucun écran « Chargement… »
bloqué ; explore-web intact.
