# Cycle de vie carte des expéditions — Design

> Date : 2026-05-24 · App : explore-web · Statut : validé (brainstorming)
> Sujet : les bannières d'expédition restent sur la carte indéfiniment après leur date.

## 1. Problème

Les bannières d'expédition posées sur la carte ne disparaissent jamais une fois
la date du RDV (`rdv_at`) passée. Elles devraient s'effacer progressivement puis
basculer dans les Archives.

## 2. Cause racine (vérifiée)

Le sous-système Expéditions possède **déjà** une machine à états prévue pour ça,
mais elle n'a jamais été allumée. Deux têtes au même bug :

1. **`archive_passed_voyages()` (mig 109) n'a jamais été branchée à un cron.**
   Elle a été écrite quand pg_cron n'était pas activé sur le projet. pg_cron a été
   activé depuis (push notifs V0.7.7, mig 144-146 utilisent `cron.schedule`), mais
   personne n'est revenu brancher l'archivage. **Résultat : aucune expédition ne
   quitte jamais le statut `published`.**

2. **`list_voyages_upcoming()`** (RPC qui alimente les bannières via
   `ExpeditionBanners.tsx`) filtre `WHERE status = 'published'`, **sans jamais
   comparer `rdv_at` à `now()`**. Tant que le statut reste `published`, la bannière
   s'affiche — même des mois après le RDV.

**Casualité collatérale (découverte en route)** : la section "compte rendu" de la
modale (`ExpeditionModal.tsx`, ligne ~508) ne s'affiche que si
`status IN ('passed','archived')`. Comme aucune expédition n'a jamais atteint
`passed`, **la section compte rendu n'a jamais été affichée à personne**. Le même
cron mort a gardé les bannières sur la carte ET rendu les comptes rendus invisibles.

## 3. Modèle d'états (inchangé, enfin utilisé)

```
published ──(rdv_at passé)──> passed ──(rdv_at + 7j)──> archived
  sur carte (couleur)         sur carte N&B + fade      hors carte, Archives publiques
                              chat ouvert                chat fermé
```

- `rdv_at = NULL` (expé "à définir", mig 111) → reste `published`, jamais N&B.
  Correct : elle est encore en préparation.
- Comptes rendus postables en `passed` ET `archived` (RPC inchangée), mais la
  section UI est **masquée** dans ce chantier (voir §6).

## 4. Décisions verrouillées

| Sujet | Décision |
|-------|----------|
| Comportement carte | Période de grâce **N&B + fade** sur la carte, puis disparition |
| Horloges | **Couplées (1 horloge)** : à J+7, disparaît de la carte **+** Archives publiques **+** chat fermé, d'un coup |
| Durée de grâce | **7 jours** |
| Comptes rendus | **Masqués** (dormance) dans ce chantier. Refonte "album-souvenir chef" parquée au backlog Citadelle |

## 5. Backend — migration 172 (cohésive)

Une seule migration `172_v07_expeditions_map_lifecycle.sql` contenant trois pièces :

### 5a. Redéfinir `archive_passed_voyages()` — 30j → 7j
Copier-coller intégral de la baseline (mig 109, cf. règle B1 xo-discipline), puis
changer **uniquement** la transition `passed → archived` de
`interval '30 days'` → `interval '7 days'`. Les autres transitions inchangées
(`published → passed` à `rdv_at <= now()` ; `cancelled → DELETE` à
`cancelled_at + 30 days`).

### 5b. Brancher le cron (le vrai fix)
Pattern aligné sur mig 144 :
```sql
SELECT cron.unschedule('archive_passed_voyages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive_passed_voyages');
SELECT cron.schedule('archive_passed_voyages', '7 * * * *',  -- toutes les heures, minute 7
  $$ SELECT public.archive_passed_voyages(); $$);
```
(Minute 7 plutôt que 0 — éviter le pic d'horloge, cf. convention.)

### 5c. Nouveau RPC carte `list_voyages_for_map()`
Copie de `list_voyages_upcoming()` (mig 105) avec **un seul** changement :
`WHERE v.status IN ('published','passed')`. Retourne déjà `rdv_at` + `status` —
**aucun nouveau champ**. `SECURITY DEFINER`, `GRANT EXECUTE ... TO authenticated`.

> On **ne touche pas** `list_voyages_upcoming` : il reste `published`-only car il
> alimente aussi la liste HUD "à venir" (`ExpeditionsList`), le créateur et le hook
> chat. Élargir le RPC partagé ferait apparaître des expés passées dans la liste
> "à venir" — faux. Frontière propre : un RPC dédié à la carte.

## 6. Frontend

### 6a. Store — nouveau champ `mapBanners`
Dans `expeditionsStore.ts` : ajouter `mapBanners: ExpeditionListItem[]` +
`setMapBanners`. Distinct de `upcoming` (qui reste réservé au HUD/créateur/chat).

### 6b. `expeditionsApi.ts` — wrapper
Ajouter `listExpeditionsForMap()` appelant `list_voyages_for_map`. Laisser
`listUpcomingExpeditions()` intact.

### 6c. `ExpeditionBanners.tsx`
Bascule de `listUpcomingExpeditions` / `upcoming` vers
`listExpeditionsForMap` / `mapBanners`. Conserve le refresh 60s.

### 6d. `ExpeditionBanner.tsx` (rendu) — N&B + fade
Calcul de l'état à partir de **`rdv_at`** (pas seulement du statut → robuste au
décalage ≤ 1h du cron) :
- `rdv_at` futur ou `NULL` → rendu normal.
- `rdv_at` passé → `filter: grayscale(1)` + opacité dégressive linéaire de
  **1.0** (juste passé) à **0.35** (à J+7). Formule :
  `opacity = clamp(1 - 0.65 * (ageJours / 7), 0.35, 1)`.
- Reste cliquable (ouvre la modale).

### 6e. `ExpeditionModal.tsx` — masquer la section compte rendu
Vraie dormance : neutraliser la condition d'affichage de la section "Comptes
rendus · galerie" via une constante explicite + commentaire pointant le backlog,
plutôt qu'une suppression :
```tsx
// Section masquée le 2026-05-24 en attendant la refonte "album-souvenir chef".
// Cf. backlog Citadelle. Les RPCs compte rendu restent en place (dormance UI).
const REPORTS_SECTION_ENABLED = false
...
{REPORTS_SECTION_ENABLED && (e.status === 'passed' || e.status === 'archived') && ( ... )}
```

## 7. Hors périmètre (parqué)

- **Refonte "album-souvenir chef uniquement"** : seul le chef poste des photos
  souvenir (au lieu de comptes rendus multi-participants). Bonne piste pour réduire
  la friction, mais c'est une refonte (autorisation RPC `upsert_voyage_report`, UI,
  galerie) → chantier dédié. À loguer au backlog Citadelle.
- **Notif "ton expédition est passée, raconte-la"** : le hook naturel serait la
  transition `published → passed`. Hors scope tant que les comptes rendus sont en
  dormance.
- **Cleanup blobs Storage orphelins** (voyages cancelled supprimés) : déjà connu,
  cf. note mig 109. Inchangé.

## 8. Vérification post-livraison

- `pnpm build` (tsc strict + vite) OK.
- Appliquer la migration (`pnpm dlx supabase db push`) puis vérifier en prod que
  `cron.job` contient bien `archive_passed_voyages` et qu'une expé au `rdv_at`
  passé bascule en `passed` à la prochaine heure.
- Vérifier visuellement : bannière passée en N&B + fade, disparition à J+7,
  présence dans les Archives.
- Liste HUD "à venir" : confirmer qu'elle n'affiche **pas** les expés passées.
