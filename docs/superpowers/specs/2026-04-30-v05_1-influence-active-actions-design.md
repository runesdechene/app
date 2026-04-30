# V0.5.1 — Influence par actions actives

> Brainstormé le 30 avril 2026 (Uriel + XO).
> Migration cible : `015_v05_1_active_actions.sql`.

## Contexte

V0.5 actuelle distribue de l'influence territoriale via 4 canaux :
1. **Placement actif** (depuis le stock du joueur) — `placed_points`
2. **Visite GPS** — `permanent_points`
3. **Création de lieu en GPS** — `permanent_points` (+30 fixe)
4. **Contributions / carnets votés** — `content_points` (recalc par votes_up)

Bug observé pendant la session 30/04 : les `content_points` créaient un **frein psychologique au like**. Un joueur ne veut pas liker le récit d'un membre d'une autre faction car ça donne de l'influence à cette faction sur le lieu. Le like, censé exprimer une appréciation, devient un acte stratégique.

## Décision

**L'influence territoriale ne provient plus que d'actions actives**. Les contributions et likes ne touchent plus l'influence du lieu. Les likes deviennent une **monnaie de gloire personnelle** pour l'auteur du carnet liké.

### Barème final

| Action | Effet sur le lieu | Effet sur le joueur |
|---|---|---|
| Créer un lieu (toujours) | **+10 placed_points** (faction du créateur) | inchangé (+25 stock influence, +5 exploration) |
| Créer un lieu en GPS | **+20 placed_points supplémentaires** (= 30 GPS total) | +10 exploration GPS (existant) |
| Visite GPS / revisite | inchangé (permanent_points, exploration) | inchangé |
| Placer de l'influence active | inchangé (placed_points, -stock) | inchangé |
| Carnet créé | **0** sur le lieu | inchangé (érudition, influence stock) |
| Recevoir un like sur son carnet | **0** sur le lieu | **+5 glory_bonus** à l'auteur |
| Donner un like | rien | rien |
| Downvote reçu | rien | rien (informatif) |

### Schéma DB

- **Colonne ajoutée** : `users.glory_bonus integer NOT NULL DEFAULT 0`
- **Formule Gloire** redéfinie : `Gloire = exploration_points + erudition_points + glory_bonus`
  → Cette formule s'applique partout où Gloire est calculée (`get_player_profile`, leaderboards, profil).
- **Colonne dépréciée** : `place_influence.content_points` reste en base (DEFAULT 0) mais n'est plus alimentée. Pas de DROP — préservation pour futur usage éventuel.
- **Table `user_place_influence.content_points`** : idem (préservée à 0).

### Fonctions modifiées

| Fonction | Changement |
|---|---|
| `create_place` | Retire `PERFORM recalc_place_content_points`. Ajoute INSERT placed_points : 10 toujours + 20 supplémentaires si GPS (au lieu des 30 permanent_points actuels). |
| `_vote_contribution_internal` | Retire `PERFORM recalc_place_content_points`. Ajoute UPDATE users SET glory_bonus = glory_bonus + 5 WHERE id = (auteur du carnet) — uniquement pour vote_up. Vote_down : rien. |
| `recalc_place_content_points` | DROP (devient inutile). |
| `get_place_guardian` | Réécrit : top user par SUM(placed_points + permanent_points) dans `user_place_influence` WHERE place_id = p_place_id. |
| `get_player_profile`, `get_my_informations`, `get_leaderboard` | Inclure `glory_bonus` dans le calcul de Gloire si applicable. |

### Backfill (one-shot dans la migration)

1. **Wipe content_points** : `UPDATE place_influence SET content_points = 0` ; `UPDATE user_place_influence SET content_points = 0`.
2. **Bonus création rétroactif** — pour chaque place existante avec `author_id IS NOT NULL` et `users.faction_id IS NOT NULL` :
    - Calculer le bonus : 10 par défaut, +20 si `places_discovered.method = 'gps'` AND `user_id = author_id`.
    - INSERT le bonus dans `place_influence.placed_points` (agrégat) ET dans `user_place_influence.placed_points` (granularité), pour préserver l'invariant `SUM(user_place_influence) = place_influence`.
3. **Glory bonus rétroactif** : pour chaque contribution `place_contributions WHERE type = 'carnet' AND votes_up > 0`, ajouter `votes_up * 5` au `glory_bonus` de son auteur. Cohérent avec le nouveau barème (chaque like passé devient rétroactivement +5 gloire).
   *Note : seuls les carnets bénéficient de cette gloire — pas les autres types de contributions (photo, accessibilité, etc.) qui n'avaient pas de mécanique de récompense par vote dans le baseline.*

### Reboot saisonnier (Coupes des Héritages — design séparé)

À designer dans une session dédiée. Hypothèses provisoires pour V0.5.1 :
- `placed_points` : wipés à chaque reboot (chaque saison repart à plat)
- `permanent_points` : conservés (visites GPS = mémoire physique du joueur)
- `glory_bonus`, `exploration_points`, `erudition_points` : conservés (prestige perso transcende les saisons)

La mécanique exacte des Coupes (action dédiée, parcours, témoignages, etc.) reste à brainstormer. Cette V0.5.1 ne préjuge pas du système de conquête saisonnier — elle pose juste les bases d'un système d'influence territoriale propre et lisible.

## Implications & risques

- **Reset visuel des territoires** au backfill : les lieux dont le seul porteur d'influence était le content_points (carnets de faction non native) deviennent neutres. À 1 mois du lancement public (17 avril), peu de lieux sont concernés. Le bonus création rétroactif (+10 / +30 GPS au créateur) compense largement.
- **Le `vote_power`** dans `get_territory_votes` continue d'utiliser `_user_blob_influence` qui somme `placed + content + permanent`. Avec content = 0 partout, c'est équivalent à `placed + permanent`. Pas de modif nécessaire.
- **L'invariant** `SUM(user_place_influence.X) = place_influence.X` est préservé tant que toutes les modifications passent par les fonctions sécurisées.
