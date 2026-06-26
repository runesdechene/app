# SPEC — Grades libres des Compagnies

> Évolution du système de grades (livré 25/06, migs 305-308, fixed-4 en prod) vers une
> **échelle entièrement définie par chaque Compagnie** : nombre de grades variable, capacités
> réglables, seuil de gouvernance choisi par le Chef. Conçu avec Uriel le 26/06.

---

## 1. Le besoin

Le modèle figé (Seigneur / Co-seigneur / Officier / Membre, capacités 1/1/3/reste codées en dur)
est trop rigide. Chaque Compagnie doit pouvoir **composer sa propre hiérarchie** : ajouter/retirer
des grades, décider combien de membres chaque grade couvre, et qui gouverne.

## 2. Modèle

**Échelle = liste ordonnée de 2 à 6 grades**, du sommet (position 1) vers la base.

- Chaque grade porte : **libellés** `m / f / n` (accordés au `title_gender` du membre, inchangé) + une **capacité** = nombre de membres qu'il couvre (top N).
- Le **dernier grade = « le reste »** (catch-all) : capacité nulle (prend tous les membres restants), **renommable mais jamais supprimable**. C'est le plancher.
- Les capacités s'**empilent** depuis le haut. Ex. `[Seigneur:1, Co-seigneur:2, Officier:5, Membre:reste]` → positions de classement `1` / `2-3` / `4-8` / `9+`.
- **Min 2 grades** (1 rang + le reste), **max 6**.
- Une capacité supérieure au nombre de membres = grade à moitié vide : aucun souci, les membres remplissent depuis le haut.

**Défaut** (Compagnie sans personnalisation) : `Seigneur:1 · Co-seigneur:1 · Officier:3 · Membre:reste` (= comportement actuel exactement).

## 3. Calcul du grade d'un membre

Le **classement reste inchangé** : `_user_faction_coupe(saison) + crowns_invested + crowns_conquered/10`, tri `joined_at ASC`, **membres principaux uniquement** (allié = hors échelle, aucun grade).

Algorithme : position du membre dans ce classement (1-based) → on parcourt les grades du haut en accumulant les capacités → le membre tombe dans le grade dont la tranche contient sa position. Au-delà de la dernière capacité → le catch-all.

`_member_grade_rank(user, faction)` renvoie désormais la **position de grade `1..N`** (1 = sommet), `NULL` si allié/non-membre.

## 4. Gouvernance (décidée par le Chef)

- **`factions.govern_grades`** (int, défaut **2**, borné `[1, N-1]` — ne peut jamais inclure le catch-all) : les membres dont le grade est en position **≤ `govern_grades`** ont les pouvoirs **éditer l'identité**, **éditer les grades**, **inviter**, **exclure un membre**.
- **Seul le Chef** (grade position 1) peut **changer `govern_grades`**.
- **Seul le Chef** peut **supprimer la Compagnie** (jamais un autre grade, quel que soit le seuil). Les Compagnies officielles RdC (`created_by IS NULL`) restent non-supprimables via l'UI (inchangé).

> Récap : le Chef décide *quel rang* a les pouvoirs ; les pouvoirs courants s'étendent au top `K` ; la suppression reste sa prérogative exclusive.

## 5. Données (additif)

- `faction_grade_labels` : **+ colonne `capacity int NULL`** (NULL = catch-all), et **nombre de lignes variable** (2-6) par Compagnie au lieu de 4 figées. La PK reste `(faction_id, rank)` où `rank` = position 1..N.
- `factions` : **+ colonne `govern_grades int NOT NULL DEFAULT 2`**.
- **Backfill** : les Compagnies ayant déjà des lignes custom → on **conserve les libellés** et on pose les capacités `1 / 1 / 3 / NULL` sur les rangs `1 / 2 / 3 / 4`. Les Compagnies sans lignes → restent sur le défaut (résolu en code, pas de seeding).
- Anti-corruption : à l'enregistrement, le serveur **réécrit l'intégralité** des lignes de grade de la Compagnie (delete + insert transactionnel), valide `2 ≤ N ≤ 6`, force la dernière ligne en catch-all (`capacity = NULL`), clampe `govern_grades` à `[1, N-1]`.

## 6. RPC

- `_member_grade_rank(user, faction) → int|NULL` — réécrite (parcours des capacités).
- `_grade_label(faction, position, gender) → text` — lit la ligne à `rank=position` ; **fallback** sur le défaut Noblesse (Seigneur/Co-seigneur/Officier/Membre) **uniquement** pour une Compagnie sans lignes custom.
- `get_faction_detail` — par membre : `gradeRank` (position) + `gradeLabel` ; + un bloc **`grades`** = la structure complète `[{position, labelM, labelF, labelN, capacity}]` (ordonnée, catch-all en dernier) + `governGrades`, pour préremplir l'éditeur.
- `set_faction_grades(faction, grades[], govern_grades)` — **remplace** `set_faction_grade_labels` : reçoit la liste ordonnée complète (libellés + capacités) + le seuil. Gate : éditer les grades = top `K` ; mais **`govern_grades` n'est modifiable que par le Chef** (si un non-Chef l'envoie différent, on ignore le champ et on garde l'ancien). Validation serveur (§5).
- `update_faction_identity` / `remove_faction_member` : gate passe de « rang ≤ 3 » à **« rang ≤ `govern_grades` »** (exclure inclus). `delete_faction` : gate **rang = 1** (Chef) au lieu de `founder`/`created_by` — *(à confirmer en revue : aujourd'hui c'est le fondateur ; Uriel veut le Chef. Voir §9.)*

## 7. UI — éditeur de grades (vue plein-modale, déjà en place)

La vue « ✦ Grades » du Hall (déjà refondue en vue interne) devient un éditeur de **structure** :
- Une **liste de lignes ordonnées**. Chaque ligne : libellés `Masculin / Féminin / Neutre` + un champ **nombre** « couvre N membres ».
- **`+ Ajouter un grade`** (jusqu'à 6) insère une ligne au-dessus du catch-all. **`✕`** sur chaque ligne la retire (bloqué si on tomberait sous 2 grades).
- La **dernière ligne = « le reste »** : libellés éditables, **pas de champ nombre, pas de ✕**.
- **Réservé au Chef** (position 1) : un sélecteur **« Jusqu'à quel grade gouverne ? »** (`govern_grades`, 1 à N-1). Masqué pour les autres gouvernants.
- Bouton **« Enregistrer les grades »** collé en bas → `set_faction_grades` (toute la structure d'un coup) → retour au classement + reload.
- Édition réservée aux grades en position ≤ `govern_grades` (sauf le sélecteur de seuil = Chef).

L'éditeur d'identité reste la vue interne « ✎ Éditer » (déjà fait). La **suppression** (bouton « 🗑 Supprimer ») n'apparaît que pour le Chef.

## 8. Hors-périmètre (YAGNI)

- Réordonnancement libre des grades (l'ordre = ordre de la liste, du haut vers le bas).
- Drapeau « peut gouverner » par grade (remplacé par le seuil unique `govern_grades`).
- Capacités en % ou par score (on reste sur un **nombre** de membres).
- Héraut de montée (toujours différé, décision séparée).

## 9. À trancher en revue

1. **`delete_faction`** : aujourd'hui gaté **fondateur** (`created_by`). Uriel veut **Chef** (grade position 1). Le Chef peut différer du fondateur (le fondateur peut se faire dépasser). Confirmer : delete = Chef courant (et non plus le fondateur) ? Conséquence : un fondateur dépassé ne peut plus supprimer « sa » Compagnie ; le nouveau Chef le peut.
2. **Migration des libellés existants** : confirmé — on garde, capacités 1/1/3/reste.
