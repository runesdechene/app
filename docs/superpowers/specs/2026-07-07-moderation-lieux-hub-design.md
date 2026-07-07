# Page de modération des lieux (Hub)

> Spec — 2026-07-07 · statut : validé, prêt pour plan d'implémentation

## Problème

3083 lieux existent en base. Beaucoup portent de mauvais tags ou n'ont rien à
faire sur l'application. Il faut une page Hub dédiée pour que des **modérateurs**
(rôle `moderator`, distinct d'`admin`) corrigent les lieux et suivent lesquels
ils ont déjà passés en revue. Les modérateurs n'ont accès qu'à **deux** pages du
Hub : cette page de modération et la page **Tags**.

## Ce qui existe déjà (on s'appuie dessus, on ne réinvente pas)

- **`places`** : `author_id`, `place_type_id` (mort — vaut `'lieu'` partout, jamais
  affiché ni édité, on l'ignore), `title`, `text`, `address`, coords, `masked`,
  `private`, `sensible`.
- **`place_tags`** : jusqu'à 3 tags par lieu, 1er = `is_primary`. Colonne
  `created_by` (paternité anti-triche). **La seule classification vivante.**
- **`set_place_tags(place_id, tag_ids[])`** : remplace les tags, valide, préserve
  la paternité, **journalise dans `place_tags_revisions`**. Mais gated
  `_can_edit_place_meta` = présence/veille (pensé joueur) → inadapté à un mod.
- **`_can_edit_place_meta`** : strictement présence (auteur / explorateur /
  découverte GPS / veilleur). Un mod qui n'a jamais visité échoue.
- Rôle **`moderator`** déjà présent dans les policies RLS. Le Hub bloque tout sauf
  `admin` (`useAuth.isAdmin`).
- `masked = false` est filtré partout (carte, sièges, home, stats) → **masquer
  retire réellement le lieu de l'app**, réversible, sans perte de données.

## Décisions

1. **Vérifié = état global du lieu**, avec trace de qui/quand. Pas de vérif
   par-modérateur, pas de file à statuts multiples.
2. **Vérifié = action explicite et découplée de l'édition.** Un bouton bascule
   `Marquer comme vérifié` / `Retirer la vérification`. Éditer un lieu ne le
   marque **pas** vérifié automatiquement (revue partielle possible).
3. **Une seule classification : les tags.** Pas d'édition de `place_type_id`.
4. **Retrait d'un lieu = masquage réversible seul.** Pas de suppression dure. Un
   modérateur ne peut jamais détruire de données joueur ; le ménage dur reste à
   un admin, hors de cette page.
5. **Canal modérateur privilégié et propre** : RPCs dédiées, gated par rôle, qui
   n'écrivent **jamais** dans `place_contributions` / `activity_log` / notifs
   (une action de modération n'est pas une contribution de jeu).

## Modèle de données (SQL)

### `places` — deux colonnes

```sql
ALTER TABLE public.places
  ADD COLUMN verified_at timestamptz NULL,
  ADD COLUMN verified_by text NULL REFERENCES public.users(id) ON DELETE SET NULL;
```

- **Vérifié** ⟺ `verified_at IS NOT NULL`.
- « Les lieux que j'ai vérifiés » ⟺ `verified_by = <moi>`.

### Audit `place_moderation_log`

```sql
CREATE TABLE public.place_moderation_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id     varchar(255) NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  moderator_id text NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  action       text NOT NULL,   -- 'set_tags' | 'update' | 'mask' | 'unmask' | 'verify' | 'unverify'
  detail       jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_place_moderation_log_place ON public.place_moderation_log (place_id, created_at DESC);
```

Trace de qui a fait quoi — dans la culture anti-triche du repo (cf.
`place_tags_revisions`). Les changements de tags restent aussi journalisés dans
`place_tags_revisions` par la RPC dédiée.

## RPCs modérateur (SECURITY DEFINER, gated staff)

Helper commun :

```sql
CREATE FUNCTION public._is_staff(p_caller text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = p_caller AND role IN ('admin','moderator')
) $$;
```

Toutes les RPCs ci-dessous : identité via `_caller_user_id()` (JWT, non
spoofable), rejet si `NOT _is_staff(caller)`, écriture d'une ligne
`place_moderation_log`, **aucune** écriture jeu (contributions/activity/notifs).

| RPC | Rôle |
|-----|------|
| `mod_list_places(p_search, p_filter, p_tag_id, p_limit, p_offset)` | Liste paginée : lieux + leurs tags (array) + état vérifié + auteur ; renvoie `{ rows, total }` pour le pager. `p_filter ∈ {'unverified','verified','all'}`. `p_search` = ILIKE sur `title`. `p_tag_id` optionnel. Ordre : non vérifiés d'abord, puis `created_at`. |
| `mod_set_place_tags(p_place_id, p_tag_ids[])` | Remplace les tags (1-3, 1er = primary) ; réutilise la logique de `set_place_tags` (validation, paternité, **journal `place_tags_revisions`**) mais gate = `_is_staff`, pas la présence. |
| `mod_update_place(p_place_id, p_title, p_text, p_sensible)` | Update direct de `title` / `text` / `sensible`. |
| `mod_set_masked(p_place_id, p_masked bool)` | Masque / démasque. |
| `mod_set_verified(p_place_id, p_verified bool)` | `p_verified=true` → `verified_at=now(), verified_by=caller` ; `false` → remet à NULL. |

Grants : `REVOKE ALL FROM PUBLIC, anon` ; `GRANT EXECUTE TO authenticated,
service_role` (le gate `_is_staff` fait le filtrage réel).

## Gate de rôle (frontend Hub)

- **`useAuth`** : exposer `isStaff` (`admin` OU `moderator`) et `isModerator`.
  `fetchRole` reste requêté par email (convention existante).
- **`App.tsx`** :
  - Accès autorisé si `isStaff`. Un **modérateur pur** ne peut atteindre que
    `/moderation` et `/carte/tags` ; toute autre route → `AccessDenied`.
  - Un **admin** garde l'accès à tout (inchangé).
- **`Sidebar`** : si `isModerator && !isAdmin`, n'afficher que **Modération** +
  **Tags**. Sinon, menu complet inchangé.
- Nouvelle route `/moderation` → `<PlacesModeration />`.

## Page `PlacesModeration.tsx`

### En-tête
- Pills de filtre : `À traiter (N) · Vérifiés · Tous` (pilote `p_filter`).
- Recherche par titre (debounce → `p_search`).
- Filtre par tag (dropdown des `tags` → `p_tag_id`).
- Barre de progression : `X / 3083 vérifiés`.

### Liste (paginée serveur, 50/page)
Chaque ligne, orientée **jugement rapide** (validé maquette 2026-07-07) :
vignette · titre · tags (badges, 1er = principal) · **auteur** · **ancienneté**
(`il y a X`) · adresse · **nb de visites** · **nb de photos** · pastille état
vérifié. Pager précédent/suivant (offset/limit) alimenté par `total`.

**Signaux d'alerte** affichés en ligne (aident à repérer un lieu à retirer) :
flag rouge « tag douteux » (heuristique légère, ex. 0 tag ou tag incohérent),
et mise en avant de `0 visite` / `0 photo` sur un compte récent. Purement
indicatif, ne bloque rien.

### Panneau d'édition (clic sur une ligne)
Deux colonnes.

**Gauche — éditable :**
- Sélecteur de tags : badges issus de la table `tags`, max 3, 1er sélectionné =
  primary (marqué ★). Sauve via `mod_set_place_tags`.
- Champs `title`, `text`, toggle `sensible`. Sauve via `mod_update_place`.

**Droite — contexte lecture seule** (le « maximum d'infos » demandé) : `id`,
auteur (+ niveau & nombre de lieux créés, pour flairer un compte douteux), date
de création + de modif, adresse complète, coords (lien Maps), compteurs
**visites / découvertes / influence / photos / note moyenne**, état
(visible|masqué, sensible), historique de vérification. Toutes ces valeurs sont
renvoyées par `mod_list_places` (ou une `mod_get_place(place_id)` dédiée si la
charge par ligne devient lourde — à trancher au plan).

**Actions :**
- `Marquer comme vérifié` / `Retirer la vérification` (bascule, `mod_set_verified`).
- `Masquer` / `Démasquer` (`mod_set_masked`).
- Après toute action : refetch serveur (règle Hub « refetch après save ») ; la
  ligne se met à jour et sort de la file `À traiter` si vérifiée.

### Conventions Hub respectées
- Pattern `SaveBar` pour l'édition champs (title/text/sensible) — pas d'auto-save.
- `try/finally` autour des fetch (pas de « Chargement… » infini).
- Deep copy pour comparaison (`JSON.parse(JSON.stringify(...))`).
- TS strict, pas de `any`. Composant dans le bon sous-dossier ; si > 300 lignes,
  extraire types/sous-composants (ligne, panneau d'édition, sélecteur de tags).

## Hors périmètre (YAGNI)

- Création de comptes modérateurs (fait via SQL / page Users existante).
- Suppression dure de lieux (réservée admin, hors cette page).
- Édition du `place_type_id` (colonne morte).
- Carte interactive (liste filtrable suffit pour du volume).
- File à statuts multiples / workflow d'approbation à plusieurs mains.

## Critères de succès

1. Un `moderator` se connecte au Hub et ne voit que **Modération** + **Tags**.
2. Il liste les lieux, filtre « À traiter », cherche par titre, filtre par tag —
   le tout paginé sans charger les 3083 d'un coup.
3. Il corrige les tags d'un lieu ; le changement est journalisé
   (`place_tags_revisions` + `place_moderation_log`) et visible dans l'app.
4. Il marque un lieu vérifié ; il ressort de « À traiter » et apparaît dans
   « Vérifiés » avec son nom comme `verified_by`.
5. Il masque un lieu ; le lieu disparaît de la carte publique (réversible).
6. Un modérateur ne peut ni supprimer un lieu, ni atteindre une autre page du Hub.
