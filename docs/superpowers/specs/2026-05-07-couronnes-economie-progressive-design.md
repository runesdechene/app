# Couronnes — Économie progressive (V0.7+)

> **Date** : 2026-05-07
> **Statut** : design validé, en attente de plan d'implémentation
> **Auteur** : Uriel + XO

## 1. Problème

Le système actuel (mig 029) cap silencieusement à **15 coffres visibles/jour**, peu importe le nombre de lieux veillés par le joueur. Conséquences :

- **Joueurs "0 lieu"** : aucun coffre, dépendent uniquement de l'énigme quotidienne (+1). Sentiment d'être bloqués hors du système Couronnes.
- **Gros bâtisseurs (100-400 lieux)** : 15 coffres = identique à un joueur de 15 lieux. Investissement dans la cartographie/plantage non récompensé. Sentiment "à quoi bon".

Le cap protège l'inflation et le futur équilibrage de la Phase 5 (influence à distance par Couronnes), mais à coût UX trop élevé aux deux extrêmes.

## 2. Vision

Couronnes = **mélange de sources patrimoniales et actives**.

- **Patrimoine** (bâtisseurs) : récolte progressive et dégressive selon le nombre de lieux veillés. Plus tu as investi, plus tu récoltes, mais ratio diminuant pour préserver l'équilibre.
- **Actions** (tous, y compris "0 lieu") : énigmes + découvertes de lieux + mini-quête quotidienne. Baseline universel pour ne laisser personne hors du jeu.
- **Drip intra-journée** : les coffres apparaissent étalés dans la journée (pas tous d'un coup à minuit) → engagement répété, sensation de "vie" du système.
- **Pas d'accumulation multi-jours** : reset à minuit. Tu ne te connectes pas, tu rates tes Couronnes du jour. Préserve le rituel quotidien et évite les pics asymétriques de pouvoir d'achat pour la Phase 5.

## 3. Mécanique principale — patrimoine par tirage indépendant

### 3.1 Principe

**Chaque lieu veillé du joueur lance son propre tirage chaque jour.** La probabilité par lieu décroît avec le nombre total de lieux veillés (`N`), de sorte que :

- L'**espérance du nombre de coffres** sur une journée croît avec `N` mais avec ratio dégressif.
- Le **nombre exact** varie naturellement d'un jour à l'autre (loi binomiale) → narrativité, "jours d'épiphanie" et "jours plus calmes" sans coder de variance ad hoc.
- Planter un nouveau lieu n'est jamais punitif pour les anciens : la proba baisse imperceptiblement, mais on gagne toujours un tirage de plus.

### 3.2 Formule

```
p(N) = min(1.0, K / sqrt(N))
```

Avec `K = 3.87` (= sqrt(15)), pour que `p(15) = 1.0` (tout joueur ≤ 15 lieux voit tous ses coffres tous les jours).

| N lieux | Proba par lieu | Coffres moy/jour | Écart-type σ |
|---|---|---|---|
| 15 | 100% | 15 | 0 |
| 25 | 77% | 19 | 2.1 |
| 50 | 55% | 27 | 3.5 |
| 100 | 39% | 39 | 4.9 |
| 200 | 27% | 55 | 6.3 |
| 400 | 19% | 77 | 7.9 |
| 800 | 14% | 109 | 9.5 |

L'écart-type binomial est `√(N×p×(1-p))`. Concrètement, 68% des jours tombent dans `[moy − σ, moy + σ]`, et 95% dans `[moy − 2σ, moy + 2σ]`. Donc pour N=400 : la plupart des jours entre 69 et 85, jours d'épiphanie à 90+, jours moyens à 75-80.

### 3.3 Sélection déterministe

Le tirage par lieu est **déterministe sur la journée** (pas de scintillement entre 2 refresh) :

```sql
WHERE (('x' || substr(md5(p_user_id || '-' || pv.place_id || '-' || current_date::text), 1, 8))::bit(32)::int % 1000) < (p(N) * 1000)
```

→ Stable durant la journée, roule à minuit (`current_date` change), pas de table de cache.

### 3.4 Drip intra-journée

Chaque coffre éligible aujourd'hui se voit attribuer une **minute d'apparition** déterministe entre **6h et 20h** (840 minutes), calculée depuis le même hash :

```sql
spawn_minute = (md5_hash >> 32) % 840 + 360  -- 360 min = 6h
```

`get_my_crowns_state` filtre :

```sql
AND spawn_minute <= EXTRACT(HOUR FROM now()) * 60 + EXTRACT(MINUTE FROM now())
```

Résultat :
- 6h-8h : ~10% des coffres apparus
- 12h : ~45%
- 16h : ~70%
- 20h : 100%
- Après 20h jusqu'à minuit : tout reste dispo (pas de FOMO sur 1 journée)

## 4. Sources baseline universel ("0 lieu")

| Source | Gain | Plafond/jour | Nature |
|---|---|---|---|
| Énigme du jour | +1 | 1 (existant) | Action ponctuelle |
| Découverte d'un lieu (1ère visite GPS) | +1 | Limité par énergie (~5/jour selon l'éco énergie actuelle) | Action |
| Mini-quête "Découvre 3 lieux aujourd'hui" | +1 bonus | 1 (déclenché par 3 découvertes) | Quête |

**Total potentiel pour un "0 lieu" actif** : ~7 Couronnes/jour. Inférieur au minimum bâtisseur (15) mais suffisant pour rester dans le jeu, et incitatif pour devenir bâtisseur.

## 5. Paramétrage à chaud — `app_settings`

Pour ajuster sans migration, les constantes vivent dans `app_settings` :

| Clé | Valeur défaut | Description |
|---|---|---|
| `crowns_proba_k` | `3.87` | Constante K dans `p(N) = K/sqrt(N)` |
| `crowns_proba_n_floor` | `15` | N ≤ ce seuil → 100% |
| `crowns_drip_start_hour` | `6` | Heure de début de spawn |
| `crowns_drip_end_hour` | `20` | Heure de fin de spawn (tout dispo après) |
| `crowns_stock_cap` | `500` | Plafond de stock |
| `crowns_discovery_gain` | `1` | Gain par découverte de lieu |
| `crowns_quest_discover_threshold` | `3` | Nombre de découvertes pour la mini-quête |
| `crowns_quest_discover_bonus` | `1` | Bonus de la mini-quête |

**Lecture en SQL** : `COALESCE((SELECT value::numeric FROM app_settings WHERE key = '...'), <défaut>)`. Pattern déjà utilisé dans la baseline (énigmes).

## 6. Implications & validations

### 6.1 Cap stock 500 conservé

Un joueur 400 lieux atteint le plafond stock en ~3-4 jours s'il ne dépense pas. Sain pour la Phase 5 (influence à distance) où ils dépenseront. À réévaluer si la Phase 5 introduit des coûts d'influence très élevés.

### 6.2 Phase 5 (influence à distance)

Le calibrage des coûts d'influence devra tenir compte de cette nouvelle économie. Un gros bâtisseur peut faire ~80 Couronnes/jour ; un petit ~15 ; un "0 lieu" ~7. Les coûts d'influence à distance doivent rester accessibles aux petits joueurs (sinon Phase 5 = oligarchie des bâtisseurs).

### 6.3 Joueurs avec énergie épuisée

La découverte de lieux est plafonnée par l'énergie. Si l'énergie est rare (rappel : éco énergie actuelle à vérifier), le baseline "0 lieu" peut être encore plus bas. À tester en conditions réelles avec un compte test avant de figer les paramètres.

### 6.4 Affichage côté UI

- Le compteur "X coffres dispo" doit refléter ce qui est apparu **maintenant**, pas le total prévu pour la journée. Sinon le drip n'a aucun effet UX.
- Optionnel pour V1.0 : un sous-titre dans la modale Couronnes pour annoncer "prochain coffre attendu vers HHhMM" → renforce le sentiment narratif.

## 7. Ce qui change dans le code (high-level, pas le plan)

- **mig 121 (ou suivante)** : refonte de `get_my_crowns_state` et `harvest_crown` pour utiliser le tirage par lieu + drip + paramétrage `app_settings`.
- **mig 122** : seed des clés `app_settings` avec les valeurs par défaut.
- **Sources baseline** : extension de `harvest_crown` ou nouvelle RPC `award_crown_for_discovery` + déclenchement depuis le code actuel de découverte (lib/discoverPlace.ts) ; mini-quête à brancher sur le compteur de découvertes du jour.
- **UI** : modale Couronnes affiche le compteur "live" + optionnel "prochain coffre vers HHhMM".

Le plan détaillé sera produit par `writing-plans` après validation de cette spec.

## 8. Ce qui ne change PAS

- Le visuel coffre sur la carte (mig 021/029) reste le même.
- La RPC `harvest_crown` garde la même signature côté front (placeId).
- Le cap stock 500.
- Le gain (+1 solo / +2 expé à 2+ membres) — c'est l'**éligibilité** qui change, pas le gain par coffre.

## 9. Questions ouvertes (à trancher avant le plan d'impl)

Aucune actuellement — design validé en brainstorming session 2026-05-07. Si une nouvelle question émerge à l'écriture du plan, retour ici.

## 10. Annexe — exemple complet de calcul SQL

Pour un user à 100 lieux, à 14h00 le 2026-05-07 :

```sql
-- Pour chaque place_veille du user :
WITH user_places AS (
  SELECT pv.place_id, pv.expedition_id, pv.planted_at,
    md5(p_user_id || '-' || pv.place_id || '-' || '2026-05-07') AS h
  FROM public.place_veille pv
  JOIN public.expedition_members em
    ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
),
params AS (
  SELECT
    COALESCE((SELECT value::numeric FROM app_settings WHERE key = 'crowns_proba_k'), 3.87) AS k,
    COALESCE((SELECT value::int FROM app_settings WHERE key = 'crowns_proba_n_floor'), 15) AS n_floor,
    COALESCE((SELECT value::int FROM app_settings WHERE key = 'crowns_drip_start_hour'), 6) AS h0,
    COALESCE((SELECT value::int FROM app_settings WHERE key = 'crowns_drip_end_hour'), 20) AS h1
),
n_total AS (SELECT count(*)::int AS n FROM user_places),
proba AS (
  SELECT LEAST(1.0, p.k / sqrt(GREATEST(n.n, p.n_floor))) AS p
  FROM params p, n_total n
)
SELECT up.place_id
FROM user_places up, proba pr, params p
WHERE
  -- Tirage proba par lieu
  (('x' || substr(up.h, 1, 8))::bit(32)::int::bigint % 1000) < (pr.p * 1000)
  -- Drip : minute d'apparition <= maintenant
  AND ((('x' || substr(up.h, 9, 8))::bit(32)::int::bigint % ((p.h1 - p.h0) * 60)) + p.h0 * 60)
      <= EXTRACT(HOUR FROM now())::int * 60 + EXTRACT(MINUTE FROM now())::int
  -- Cooldown 24h depuis dernière récolte (système existant à conserver)
  AND COALESCE(
    (SELECT last_harvested_at FROM crown_harvest WHERE user_id = p_user_id AND place_id = up.place_id),
    up.planted_at
  ) + interval '24 hours' <= now()
;
```

L'écriture finale dans la migration nettoiera et factorisera (CTE, helpers, etc.).
