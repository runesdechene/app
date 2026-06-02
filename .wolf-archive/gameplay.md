# Gameplay — V0.4 L'Érudition Conquérante

> On vend : de l'Appartenance et de la Découverte.
> Les factions sont des **Héritages** culturels. Les joueurs sont des **gardiens** du patrimoine.

## Vocabulaire V0.4

| Avant | Après |
|-------|-------|
| Faction | **Héritage** |
| Conquérir | **Veiller sur / Protéger** |
| Notoriété | **Gloire** |
| Chat faction | **Le Dortoir** |
| Territoire | **Terre d'influence** |

## Ressource unique : Énergie ⚡

Regen configurable (Hub > Réglages), max défaut = 3. Sert à tout : découvrir, veiller, fortifier.

## Coût par distance

**Formule :** `(base_cost × distance_mult × (1 - tag_reduction%)) + fortification_cost`

| Distance | Mult |
|----------|------|
| GPS (< seuil 1) | ×0.5 |
| Proche (< seuil 2) | ×1 |
| Moyen (seuil 2→3) | ×2 |
| Loin (> seuil 3) | ×3 |

Fortification s'ajoute APRÈS le multiplicateur (pas multipliée).

## Bonus Heritage par tag

Chaque Héritage a des réductions sur certains types de lieux (`faction_tag_bonuses`).
- Primaires : **-50%** — Secondaires : **-25%**

## Actions joueur

| Action | RPC | Gain Gloire |
|--------|-----|-------------|
| Découvrir | `discover_place` | +2 |
| Veiller | `claim_place` | +5 |
| Fortifier | `fortify_place` | +5 |
| Créer un lieu | `create_place` | — (min 5 découvertes + titre requis) |

## Fortification (5 niveaux : 0→4)

Tour de guet (1) → Tour de défense (2) → Bastion (3) → Forteresse (5 énergie, +60 influence)

## Gloire

Score pur (jamais dépensé). Classement Héritages = somme Gloire de tous les membres.

## Fragments (boutique)

Chaque achat débloque : mots de titre + bonus passif + compétence active optionnelle.

**Compétences :** free_discover, free_claim, double_glory, distance_ignore, discount_discover, discount_claim — avec cooldown configurable.

## Titres v3

Badges sélectionnables (max 3 affichés). Titres généraux (stats) + titre faction (par rang RANK()) + mots de fragments (id négatif = `fw.id * -1`).

## Territoires

Voronoi (d3-delaunay + Turf.js, Web Worker). Noms votés par les joueurs (filtrés par faction).

**Score influence (rayon) :** `0.25 + √(score - 1) × 0.65` km — score = likes×1 + vues×0.1 + explorations×3 + bonus fortif.

## Baroud d'Honneur

L'héritage le plus faible reçoit un bonus de régénération. Configurable via Hub.
