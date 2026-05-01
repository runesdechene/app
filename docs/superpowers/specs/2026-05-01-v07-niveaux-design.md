# V0.7 — Système de Niveaux & Refonte Gloire

> **Statut** : design validé Uriel le 2026-05-01, prêt pour plan d'implémentation.
> **Phase V0.7** : intercalée entre Phase 3.5 (Refonte Gloire) et Phase 4 (Campement).
> **Dépendances** : repose sur le système Coupe (mig 023), Gloire (mig 024), Couronnes (mig 021), pondération énigmes (mig 038).

---

## 1. Contexte & motivation

Aujourd'hui le score de prestige lifetime du joueur est la **Gloire** (cumulé `_enigma_score_weighted` + visites + plantages + carnets + photos + lieux ajoutés, voir mig 024 + 038). Affichée brute sur le profil et utilisée pour le leaderboard "notoriety".

Problème exprimé Uriel : *« La Gloire ne parle pas aux gens. "J'ai 300 points de gloire", on s'en fout. Par contre "je suis niveau 30 sur Runes de Chêne", ça a vraiment de la gueule. »*

Objectif : transformer la Gloire en système d'**XP qui alimente un Niveau** (palier d'identité), et utiliser le Niveau comme la jauge de prestige lifetime principale.

Contrainte forte : ne pas catapulter les vétérans actuels (top à ~7000 pts) directement au cap. La conversion doit préserver l'équité envers les nouveaux joueurs.

---

## 2. Décisions stratégiques (résumé exécutif)

| Décision | Choix retenu | Raison principale |
|---|---|---|
| Cap niveau | **50** (curseur, pas promesse) | Identitaire mais extensible avec "badges d'époque" |
| Conversion historique | **Coupure nette** (xp_total = 0 pour tous au switch) | Égalise l'équité, badge "Vétéran" en compensation |
| Symétrie suppressions | **Totale** (DELETE post-epoch retire l'XP) | Anti-triche robuste, niveau peut redescendre |
| Protection historique | **xp_epoch** : seules actions `created_at >= xp_epoch` impactent xp_total | Pré-epoch ne donne ni ne retire jamais |
| Forme de courbe | **2 régimes** : niv 1-3 hardcodés, puis exponentielle douce 25 × 1.05^(N-3) | Onboarding gratifiant + montée mérité |
| Rôle de la Gloire | **Mot vivant pour l'XP**, jamais affichée comme jauge séparée | Un seul concept de prestige = clarté |
| Découplage Coupe | **Découverte de brouillard** = Gloire seule, pas Coupe | Anti-farm de la Coupe, valorise l'exploration lifetime |
| Visite vs découverte | Visite GPS +3, découverte de brouillard +1 | Effort physique récompensé davantage |
| Gating | **Niveau 3 minimum pour ajouter un lieu** | Anti-spam des nouveaux + premier unlock mécanique |
| Badge vétéran | "Vétéran de la Première Époque", attribué une fois au switch | Reconnaît l'historique sans déformer la mécanique |
| Leaderboard | Tri par niveau (tie-break xp_total) | Reflète l'identité, pas un compteur abstrait |
| Titres généraux | Conditions migrent `glory` → `level` | Cohérence avec la nouvelle métrique principale |

---

## 3. Architecture & data model

### 3.1 Nouvelles colonnes / config

```sql
-- Compteur d'effort cumulé post-epoch (jamais affiché brut au joueur)
ALTER TABLE users ADD COLUMN xp_total integer NOT NULL DEFAULT 0;

-- Marquage des vétérans présents au switch
ALTER TABLE users ADD COLUMN veteran_first_era boolean NOT NULL DEFAULT false;

-- Date de bascule du système (constante app, secondes epoch UTC)
INSERT INTO app_config (key, value)
VALUES ('xp_epoch', extract(epoch from now())::text);
```

### 3.2 Calcul du niveau (pure function)

```sql
CREATE OR REPLACE FUNCTION public._level_from_xp(p_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_xp < 5  THEN 1
    WHEN p_xp < 13 THEN 2
    WHEN p_xp < 38 THEN 3
    -- À partir de niv 4 : cumul(N) = 13 + 25 × (1.05^(N-3) - 1) / 0.05 = 13 + 500 × (1.05^(N-3) - 1)
    -- Inversion : N = 3 + floor(ln(1 + (xp - 13) / 500) / ln(1.05))
    ELSE LEAST(50, 3 + FLOOR(LN(1 + (p_xp - 13)::numeric / 500) / LN(1.05))::int)
  END;
$$;
```

Le niveau **n'est jamais stocké** — toujours dérivé de `xp_total`. Seul le compteur `xp_total` vit en DB.

### 3.3 Triggers d'incrémentation / décrémentation

Pour chaque table d'action, deux triggers :
- `AFTER INSERT` : si `created_at >= xp_epoch`, `UPDATE users SET xp_total = xp_total + delta WHERE id = NEW.user_id`
- `AFTER DELETE` : si `OLD.created_at >= xp_epoch`, `UPDATE users SET xp_total = GREATEST(0, xp_total - delta) WHERE id = OLD.user_id`

Le `GREATEST(0, ...)` est un garde-fou : `xp_total` ne descend jamais en dessous de 0 même si une race condition rare causait un retrait dépassant le solde.

| Table | Trigger INSERT delta | Trigger DELETE delta | Notes |
|---|---|---|---|
| `places_discovered` | +1 | -1 | Nouveau — découverte du brouillard |
| `place_explorers` | +3 | -3 | Visite GPS physique (DISTINCT par construction) |
| `places` | +20 | -20 (admin only) | Lieu ajouté (création patrimoniale) |
| `place_contributions` (carnet) | +5 | -5 | Carnet écrit |
| `place_contributions` (photo) | +1 par photo (jsonb_array_length) | -N | Photo ajoutée |
| `veille_history` | +10 | jamais | Plantage (événement immuable) |
| `enigma_responses` (correct=true) | +1/+1/+2/+3 selon difficulté | jamais | Énigme résolue (immuable) |

### 3.4 Réponses RPC enrichies

Toutes les RPCs d'action (`claim_place`, `plant_flag`, `submit_enigma`, `add_carnet`, `add_photo`, `add_place`, `discover_place`, `revisit_place_gps`) retournent désormais dans leur JSON :

```json
{
  "xp_delta": 5,
  "level_before": 12,
  "level_after": 13
}
```

Le front compare `level_after > level_before` pour déclencher la modale level up. Si `level_after - level_before > 1`, modale "compactée" (animation Niveau X → Y).

---

## 4. Formule du niveau (calibration)

### 4.1 Régime onboarding (niveaux 1-3)

| Transition | Coût (Gloire) | Cumul à atteindre | Sens |
|---|---|---|---|
| 1 → 2 | 5 | 5 | Première sortie qui combine plusieurs actions |
| 2 → 3 | 8 | 13 | 2-3 sorties cumulées |

### 4.2 Régime sérieux (niveaux 3-50)

```
coût(N → N+1) = 25 × 1.05^(N - 3)   pour N >= 3
cumul(N) = 13 + 500 × (1.05^(N - 3) - 1)   pour N >= 3
```

Paliers de référence :

| Transition | Coût pour la passer | Cumul Gloire à atteindre |
|---|---|---|
| 3 → 4 | 25.0 | 38 |
| 5 → 6 | 27.6 | 92 |
| 10 → 11 | 35.2 | 252 |
| 20 → 21 | 57.4 | 717 |
| 30 → 31 | 93.4 | 1473 |
| 40 → 41 | 152.2 | 2771 |
| 49 → 50 | 235.7 | **4467** |

### 4.3 Garanties d'équilibre

- **Aucune action seule (max +20 lieu ajouté) ne fait passer un niveau ≥ 4** : coût(3→4) = 25 > 20. Vérifié.
- **L'onboarding 1-3 reste gratifiant** : la première sortie complète d'un nouveau (3 visites + 3 énigmes faciles + 1 plantage = ~22 Gloire) débloque niveau 2 et 3 d'un coup.
- **Cap atteignable mais mythique** :
  - Régulier (~150 Gloire/mois) → niveau 30 en ~10 mois, niveau 50 en ~30 mois.
  - Hardcore (~350/mois) → niveau 50 en ~13 mois.
  - Casual (~60/mois) → niveau 30 en ~24 mois, ne touchera quasi jamais 50.

---

## 5. Coefficients d'action

| Action | Gloire | Coupe | Notes |
|---|---|---|---|
| Découverte du brouillard (`places_discovered` INSERT) | **+1** | **0** | Récompense la marche exploratoire. Exclu Coupe pour éviter le farm de zone large en saison. |
| Visite GPS d'un nouveau lieu (`place_explorers` INSERT, DISTINCT place_id) | **+3** | **+3** | Effort physique, valeur de référence. |
| Énigme `very_easy` correcte | +1 | +1 | Inchangé (mig 038). |
| Énigme `easy` correcte | +1 | +1 | Inchangé. |
| Énigme `medium` correcte | +2 | +2 | Inchangé. |
| Énigme `hard` correcte | +3 | +3 | Inchangé. |
| Photo ajoutée (par photo dans `images[]`) | +1 | +1 | Inchangé (mig 038 logique de comptage). |
| Carnet écrit | +5 | +5 | ↑ depuis +3 (effort rédactionnel). |
| Plantage de bannière (`veille_history`) | +10 | +10 | ↑ depuis +5 (événement marquant). |
| Lieu ajouté (`places.author_id`) | +20 | +20 | ↑ depuis +7 (création patrimoniale). |
| Revisite GPS (`revisit_place_gps`, log `activity_log`) | 0 | 0 | Inchangé. Anti-farm garanti par DISTINCT et par mig 006 (1 revisite/jour, influence dégressive 15/10/5/3). |

**Cohérence Coupe vs Gloire** : la formule reste identique aux deux jauges sauf pour la découverte de brouillard. Les helpers SQL existants (`_enigma_score_weighted`) restent utilisés tels quels pour les énigmes.

---

## 6. Migration au switch

### 6.1 Migration SQL principale (mig `040_v07_levels_system.sql`)

Ordre des opérations en transaction :

1. **Schéma** : ALTER TABLE users ADD COLUMNS (`xp_total`, `veteran_first_era`).
2. **Constante** : INSERT app_config (`xp_epoch`, now()).
3. **Marquage vétéran** : UPDATE users SET veteran_first_era = true WHERE id IN (UNION DISTINCT des contributeurs historiques avant epoch).
4. **xp_total reste à 0** pour tous (DEFAULT 0). Coupure nette confirmée.
5. **Création de `_level_from_xp`** (function IMMUTABLE).
6. **Création des triggers** sur les 5 tables d'action.
7. **Refonte de `get_player_profile`** : retourne `level`, `xp_total`, `xpToNextLevel`, `veteran_first_era`. Plus de `glory`, `explorationPoints`, `eruditionPoints`, `glory_rank` exposés.
8. **Refonte de `get_leaderboard('notoriety', N)`** : tri par `_level_from_xp(xp_total)` DESC, tie-break `xp_total` DESC.
9. **Refonte de `get_user_titles`** : titres généraux migrent de `glory` vers `level`.
10. **UPDATE des conditions de la table `titles`** : pour chaque titre `type='general'`, remplacer `condition->>'stat' = 'glory'` par `'level'` et calibrer le `min` selon les paliers narratifs (voir §8).

### 6.2 Migration de cleanup différée (mig `~042_v07_drop_glory.sql`, ~2 semaines après déploiement)

Une fois confirmation que rien ne dépend plus de la Gloire :
- DROP `get_my_glory(text)` (RPC).
- DROP les colonnes `users.exploration_points`, `users.erudition_points` si plus rien ne les lit.
- Garder `_enigma_score_weighted` (utilisé par la Coupe).

### 6.3 Communication aux joueurs

**Changelog public** (date du déploiement) :
> *« Le système d'expérience évolue. Tous les Veilleurs reprennent depuis le Niveau 1, mais ceux qui étaient là avant gardent à vie le badge Vétéran de la Première Époque. Vos accomplissements antérieurs sont reconnus — par votre badge, et par notre mémoire. À partir d'aujourd'hui, chaque pas compte. »*

**Email aux vétérans** : version étendue du même message, avec rappel des paliers narratifs (niveau 3 = ajout de lieu débloqué, niveau 30 = palier reconnu, niveau 50 = légende).

---

## 7. UI/UX

### 7.1 Profil

- **Médaillon de niveau** (sceau de chevalier, à designer) à droite de l'avatar dans le bandeau d'identité. Affiche le numéro du niveau au centre.
- **Barre de progression** sous le médaillon, format : *« 12 Gloire avant le prochain niveau »* (texte sous la barre).
- **Badge "Vétéran de la Première Époque"** : objet visuel distinct du médaillon, affiché en permanence dans le bandeau d'identité pour les joueurs avec `veteran_first_era = true`. Visuel à designer (proposition initiale : sceau patiné, ton ocre/sépia, motif gravé).
- **Stats row** dessous : Couronnes / Coupe saison (rang) / Lieux veillés. La Gloire **disparaît** de l'affichage profil.

### 7.2 Toasts d'action

Format unifié, lyrique, narratif :
- *« +5 Gloire — tu as planté ta bannière »*
- *« +20 Gloire — tu as ajouté un nouveau lieu »*
- *« +1 Gloire — un lieu sort du brouillard »*
- *« +3 Gloire — tu as visité ce lieu »*

Comportement identique aux toasts Couronnes existants (stack, fenêtre 5min de fusion, pattern V0.6.2).

### 7.3 Modale level up

**Format standard (1 niveau gagné)** :
- Plein écran, fond gradient ocre/sombre, bordure dorée
- Label haut : *« Tu as gagné un palier »*
- Numéro grand (~48px) : *« Niveau N »*
- Citation thématique (variable selon le palier) : *« Ta gloire grandit, Veilleur. »*
- Bouton *« Continuer »*
- Animation : fade in + scale du chiffre

**Format compact (multi-niveau)** :
- Animation du chiffre qui défile : *« Niveau 8 → 11 »*
- Une seule modale, pas trois successives
- Citation adaptée : *« Trois paliers d'un coup. La marche te porte. »*

**Paliers symboliques** (10, 20, 30, 40, 50) : citation spécifique plus marquée, pas de différence mécanique sinon.

### 7.4 Modale premier login post-switch (vétérans uniquement)

Affichée une seule fois pour les joueurs avec `veteran_first_era = true` ET pas encore vu (flag à stocker côté front, ex `localStorage` `lvlSystemSwitchSeenAt`) :

> *« Une nouvelle ère commence. Tu étais là avant. Le badge **Vétéran de la Première Époque** est désormais gravé sur ton profil — il restera à vie. Reprends ta marche, Veilleur. »*

Visualise le badge en gros au centre, bouton *« Reprendre »*.

### 7.5 Gating "ajout de lieu" (niveau < 3)

- Bouton *« Ajouter un lieu »* reste visible mais **grisé** avec icône cadenas.
- Au tap : modale explicative :
  > *« L'ajout de lieux est réservé aux Veilleurs de niveau 3 et plus. Continue d'explorer pour le débloquer. Plus que **X Gloire** avant le niveau 3. »*
- Côté serveur : RPC `add_place` (et toutes les variantes de création de lieu) check `_level_from_xp(users.xp_total) >= 3` AVANT d'insérer. Erreur `level_too_low` sinon.

---

## 8. Migration des titres généraux

Les titres existants de type `'general'` (table `titles`) sont migrés via UPDATE dans la même mig que le switch.

### 8.1 Pattern stat-based (`condition->>'stat' = 'glory'` avec `min`)

Avant :
```json
{"stat": "glory", "min": 200}
```

Après (mapping basé sur les paliers de la nouvelle courbe) :
- `glory min: 50` → `level min: 4`
- `glory min: 100` → `level min: 5`
- `glory min: 200` → `level min: 8`
- `glory min: 500` → `level min: 13`
- `glory min: 1000` → `level min: 20`
- `glory min: 2000` → `level min: 27`
- `glory min: 5000` → `level min: 40`

Calibration validée à l'implémentation en regardant les seuils existants un par un.

### 8.2 Pattern rank-based (`condition->>'stat' = 'glory'` avec `rank`)

Avant : `{"stat": "glory", "rank": 10}` (top 10 du leaderboard "notoriety")

Après : `{"stat": "level", "rank": 10}` — utilise le nouveau leaderboard tri par niveau (tie-break xp_total).

### 8.3 Refactor `get_user_titles`

La fonction existante (mig 038) calcule `v_glory_rank` via RANK OVER ORDER BY (exploration_points + erudition_points). À remplacer par RANK OVER ORDER BY xp_total. Les CASE qui matchent `condition->>'stat' IN ('notoriety', 'glory')` deviennent `IN ('notoriety', 'glory', 'level')` (tolérance pour ne pas casser si certaines lignes restent).

---

## 9. Cas limites & sécurité

### 9.1 Race conditions

- **Suppression simultanée d'un contenu et d'un user** : ON DELETE CASCADE déjà en place. Le trigger DELETE du contenu se déclenche AVANT que le user soit supprimé (cascade enfant d'abord). Pas de problème.
- **Multiple actions concurrentes** : `UPDATE users SET xp_total = xp_total + delta` est atomique au niveau row. Pas de race possible.

### 9.2 Anti-triche

- Suppression admin d'un lieu : trigger CASCADE retire correctement -20 au créateur, -1 par découvreur, -3 par visiteur (DISTINCT préservé), -1 ou -5 par contributeur. Le niveau peut redescendre — comportement attendu et documenté.
- Joueur qui supprime son propre carnet/photo : retrait d'XP. Confirmation côté front : *« Cette suppression retirera N Gloire et peut faire baisser ton niveau. Continuer ? »*
- Pas de suppression de lieu par auteur (admin only, déjà en place).

### 9.3 Garde-fou xp_total ≥ 0

`UPDATE users SET xp_total = GREATEST(0, xp_total - delta)` dans les triggers DELETE. Pas de niveau négatif possible.

### 9.4 Cap dur 50

`_level_from_xp` retourne `LEAST(50, ...)`. Même si xp_total dépasse ~4750, le niveau plafonne à 50. L'XP continue à s'accumuler en interne (utile pour le tie-break leaderboard et pour préparer un futur cap relevé).

---

## 10. Hors scope (futurs développements)

- **Cap relevé à 60+** : extensible plus tard. Au moment du relevé, attribution rétroactive d'un badge "Légende — Première Époque" (ou équivalent) aux joueurs ayant atteint le cap actuel.
- **Bonus Panache** : système de multiplicateur pour actions stylées (plantage en pleine nuit, lieu très isolé, énigme résolue d'un coup) — référencé pendant le brainstorming, pas implémenté ici.
- **Unlocks supplémentaires par niveau** : pour le MVP, seul "ajout de lieu" gate à niveau 3. Futurs unlocks possibles (carnet long à niveau X, plantage défi à niveau Y, etc.) — pas dans cette phase.
- **Récompense fidélité revisite** : si plus tard on veut donner +1 Gloire bonus toutes les 5 revisites d'un même lieu (cap lifetime), ajouter avec compteur dédié. Pas dans le MVP.
- **Phase 4 Campement & Phase 5 Influence à distance** : indépendantes de cette feature, séquencées après son déploiement.
