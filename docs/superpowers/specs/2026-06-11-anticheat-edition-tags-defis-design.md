# Anti-triche — Édition de tags × Défis (Règle A)

> Spec validée le 2026-06-11 — Uriel + XO
> Statut : design approuvé, prêt pour plan d'implémentation
> Zone : `supabase/` (migrations) + `apps/explore-web` (aucun changement front requis)

## Problème

L'édition collaborative des tags de lieux a été ouverte en V0.9.49/V0.9.50 (gate « Présence ou veille » : auteur, visiteur GPS, ou veilleur peuvent retaguer un lieu via `set_place_tags`, mig 234).

Cette ouverture crée une faille de triche sur le système de **Défis** (`192_defis_v2_action_tag.sql`), le seul des trois systèmes de quêtes couplé dynamiquement aux tags :

- `_defi_progress()` (mig 192, l.41-74) compte les actions (`reveal` / `visit` / `add` / `veilleur`) en faisant un **JOIN dynamique** sur `place_tags.tag_id` à chaque lecture.
- Un joueur présent sur un lieu peut retaguer ce lieu pour le faire matcher le défi du jour, **puis** réaliser l'action — ou retaguer un lieu sur lequel il a déjà agi.

**Exploit canonique :** Défi « Planter son GPS sur un château ». Le joueur est sur une forêt, la retague en château, plante son GPS → `_defi_progress` compte 1/1 → réclamation des Couronnes sans avoir jamais visité de château.

Les deux autres systèmes de quêtes ne sont pas concernés :
- **Mini-quêtes journalières** (`056`) : comptent des actions pures, aucun tag.
- **Quêtes communautaires** (`183`) : filtrent sur `places.place_type_id`, figé à la création — `set_place_tags` ne touche que `place_tags`.

### Pourquoi le timing ne suffit pas

Une première piste (snapshot du tag au moment de l'action) a été rejetée : le joueur contrôle **à la fois** le tag et l'action, donc il contrôle l'ordre. Il lui suffit de retaguer *avant* d'agir. Toute défense basée sur le *quand* se contourne en réordonnant. Le problème est d'**autorité**, pas de timing.

## Principe retenu — Règle A

> **Tes propres *éditions* de tags ne te créditent jamais. Un tag posé par quelqu'un d'autre — ou par toi à la création du lieu — compte normalement.**

Une seule règle couvre les 4 actions :

| Cas | `created_by` du tag | Crédité au joueur ? |
|---|---|---|
| Crée un château, le tague à la création | NULL (tag d'origine) | ✅ oui — c'est la classification d'origine |
| Visite un château tagué par un autre | autre joueur | ✅ oui |
| Retague une forêt en château puis agit | le joueur lui-même (édition) | ❌ non — exclu pour lui |

La règle ferme **exactement** la porte ouverte par l'édition de tags, ni plus ni moins. Elle ne couvre volontairement **pas** le mensonge à la création (créer un faux château) : ce vecteur existait déjà avant l'édition de tags, passe par la Charte de l'explorateur, et relève de la modération/vandalisme — pas de la triche.

### Risque résiduel accepté

Collusion : deux joueurs se retaguent mutuellement les lieux. Friction élevée, détectable via l'audit log. Acceptable pour une app patrimoine à cette échelle. Si observé en prod → activer la réserve (cooldown / confirmation tierce), non implémentée ici.

## Conception technique

### 1. Tracer la paternité de chaque tag

`place_tags` gagne une colonne :

```sql
ALTER TABLE public.place_tags ADD COLUMN created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;
```

- `NULL` = tag d'origine (posé à la création du lieu). La paternité est l'auteur du lieu (`places.author_id`).
- non-NULL = tag posé via une **édition** (`set_place_tags`), porte l'id de l'éditeur.
- **Legacy** : les lignes existantes restent `NULL` → comptent pour tout le monde, **zéro pénalité rétroactive**. C'est le comportement sûr voulu.

### 2. Raffiner `set_place_tags` (mig 234)

Aujourd'hui : `DELETE` de tous les tags du lieu puis `INSERT` brutal de la nouvelle liste. Problème : un `INSERT` naïf réécrirait `created_by` même pour les tags **conservés**, attribuant à tort la paternité d'un château posé par un autre à l'éditeur courant.

Nouveau comportement :
- Pour chaque tag de la nouvelle liste qui **existait déjà** sur le lieu → **préserver son `created_by` d'origine**.
- Pour chaque tag **nouvellement ajouté** → `created_by = caller` (`_caller_user_id()`).

Implémentation : capturer l'ancien `(tag_id, created_by)` avant le `DELETE`, puis `LEFT JOIN` lors du ré-`INSERT` pour récupérer le `created_by` préexistant (COALESCE vers `caller` si absent).

### 3. Patcher `_defi_progress` (mig 192, l.57/63/69)

Chaque JOIN sur `place_tags` (actions `reveal` / `visit` / `add` / `veilleur`) gagne le prédicat :

```sql
AND (pt.created_by IS NULL OR pt.created_by <> p_user_id)
```

Le calcul reste dynamique et à-la-lecture (aucun trigger, conforme à l'architecture mig 192). Seul change : un tag posé par le joueur lui-même via édition ne matche plus **pour lui**.

L'action `enigma` n'est pas concernée (pas de jointure tag de ce type).

### 4. Audit log des tags (le filet)

Symétrie avec la description, qui log déjà (`place_description_revisions` + `activity_log`, mig 235). Aujourd'hui `set_place_tags` ne log **rien**.

Nouvelle table :

```sql
CREATE TABLE public.place_tags_revisions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id    varchar(255) NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  changed_by  uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  old_tag_ids text[] NOT NULL,
  new_tag_ids text[] NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
```

`set_place_tags` insère une révision (old vs new) + une entrée `activity_log` à chaque changement effectif.

Objectifs : détection des patterns suspects, rollback possible, base pour une future revue Hub des changements **signalés** (non bloquante).

## Hors périmètre (YAGNI)

- **Snapshot du tag à l'action** — réfuté (le joueur contrôle l'ordre).
- **Modération pré-approbation bloquante** — over-engineering + dette opérationnelle qui croît avec l'usage ; régresse l'édition collaborative tout juste livrée.
- **Cooldown / confirmation tierce (réserve B)** — gardé en réserve, activable si collusion observée.
- **Notif au gardien/veilleur à chaque changement** — audit-only pour l'instant ; notif branchée en follow-up.
- **Écran Hub de revue/rollback** — la donnée est capturée maintenant ; l'UI vient après.
- **Blindage du futur Codex/Âmes** (spawn par `type_lieu_requis`) — non implémenté en code à ce jour ; appliquera le même principe « tag d'autrui » le moment venu.

## Fichiers impactés

| Fichier | Changement |
|---|---|
| `supabase/migrations/<NNN>_*.sql` (nouvelle) | `ALTER place_tags ADD created_by` ; nouvelle table `place_tags_revisions` ; refonte `set_place_tags` (préservation paternité + log) ; patch `_defi_progress` (prédicat anti-self-edit) |
| `apps/explore-web` | **Aucun** changement requis (la faille et le correctif sont 100% serveur) |

## Critères de validation

1. Défi « visit château » : retaguer une forêt en château puis planter GPS → progression **inchangée** pour le tricheur.
2. Visiter un vrai château tagué par un autre joueur → progression **+1** (cas légitime préservé).
3. Créer un château et le taguer à la création → défi « add château » crédité (classification d'origine).
4. Retaguer son propre lieu déjà créé pour matcher un défi `add` → **pas** de nouveau crédit.
5. Éditer un lieu pour ajouter un 2e tag sans toucher le tag d'origine d'un autre → la paternité du tag conservé n'est **pas** réécrite.
6. Lieux/tags legacy (`created_by = NULL`) → comptent normalement, aucune régression.
7. Chaque appel `set_place_tags` produit une ligne `place_tags_revisions` + `activity_log`.
