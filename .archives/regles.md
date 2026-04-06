# Runes de Chêne — Règles du Jeu

> La Carte — Jeu d'exploration et de conquête du patrimoine français

---

## Concept

Runes de Chêne est un jeu de carte interactive où les joueurs explorent des lieux du patrimoine français, les découvrent, les revendiquent pour leur faction, et étendent leur territoire. Chaque action coûte de l'énergie, qui se régénère au fil du temps.

---

## Factions

Chaque joueur choisit une **faction** au début du jeu. Les factions rivalisent pour le contrôle du territoire.

- Chaque faction a un **nom**, une **couleur** et un **emblème**
- Le classement des factions est basé sur le nombre de lieux revendiqués
- La faction en tête porte la couronne 👑

---

## Énergie

L'énergie est la ressource principale du jeu. Elle se consomme pour découvrir des lieux.

| Paramètre | Valeur |
|-----------|--------|
| Maximum | **5 points** |
| Cycle de régénération | **4 heures** |
| Régénération de base | **1 point** par cycle |
| Bonus régénération | **+1 point** par tranche de **3 lieux revendiqués** |

**Formule de régénération :** `1 + floor(lieux_revendiqués / 3)` points par cycle de 4h.

Exemple : un joueur ayant revendiqué 6 lieux regagne 3 points tous les 4h.

---

## Découverte

Les lieux non découverts apparaissent **floutés** sur la carte. Pour révéler un lieu et accéder à ses détails, il faut le **découvrir**.

### Coût de découverte

| Situation | Coût en énergie |
|-----------|----------------|
| **À proximité GPS** (≤ 500m) | **Gratuit** (0) |
| **Lieu de sa propre faction** | **0.5 point** |
| **Autre lieu** (à distance) | **1 point** |

### Règles

- Un lieu découvert le reste **définitivement** pour le joueur
- Revendiquer un lieu le marque automatiquement comme découvert
- Les lieux de sa propre faction sont visibles sur la carte (mais pas "découverts" tant qu'on n'a pas payé)

---

## Revendication (Claim)

Un joueur peut **revendiquer** un lieu découvert au nom de sa faction.

- Le lieu passe sous le contrôle de la faction du joueur
- L'historique des revendications est conservé
- Revendiquer un lieu augmente le taux de régénération d'énergie
- La revendication génère un **territoire** visible sur la carte

---

## Territoires & Zones d'Influence

Chaque lieu revendiqué génère une **zone d'influence** autour de lui, visible sur la carte aux couleurs de la faction.

### Calcul du territoire

Le rayon d'influence dépend du **score** du lieu :

```
rayon = 0.25 km + √(score - 1) × 0.65 km
```

- Rayon minimum : **~150 mètres** (score de 1)
- Plus un lieu est populaire, plus son territoire est grand

Les territoires sont découpés en **cellules de Voronoï** pour éviter les chevauchements.

### Score d'un lieu

```
score = likes + (vues × 0.1) + (explorations × 2)
```

| Action | Poids |
|--------|-------|
| Exploration (découverte) | ×2 |
| Like | ×1 |
| Vue | ×0.1 |

---

## Likes

Tout joueur connecté peut **aimer** un lieu découvert.

- Un like par joueur par lieu (toggle on/off)
- Les likes augmentent le **score** du lieu (et donc son territoire)
- Les likes génèrent une **notification** visible par tous les joueurs

---

## Brouillard de Guerre (Fog of War)

- Les lieux **non découverts** sont affichés en mode flou sur la carte
- Seuls le titre et la position approximative sont visibles
- Les détails (photos, description, avis) ne sont accessibles qu'après découverte
- Les lieux de **sa propre faction** sont visibles mais coûtent quand même de l'énergie à découvrir (à tarif réduit)

---

## Notifications (Toasts)

Les actions des joueurs génèrent des **notifications en temps réel** visibles par tous :

| Type | Message | Cliquable |
|------|---------|-----------|
| **Découverte** | "X a découvert Lieu" | Oui → fly to |
| **Revendication** | "X a revendiqué Lieu pour Faction" | Oui → fly to |
| **Like** | "X a aimé Lieu" | Oui → fly to |
| **Nouveau joueur** | "X a rejoint la carte" | Non |

- Les noms de joueurs et de lieux sont affichés **en gras**
- Cliquer sur une notification **téléporte** la carte vers le lieu concerné
- L'historique des 7 derniers jours est chargé au démarrage

---

## Géolocalisation

- La position du joueur est affichée sur la carte avec un **marqueur animé** aux couleurs de sa faction
- La position GPS permet la **découverte gratuite** des lieux à moins de 500m
- Fallback sur géolocalisation IP si le GPS n'est pas disponible

---

## Rôles

| Rôle | Description |
|------|-------------|
| `user` | Joueur standard |
| `ambassador` | Ambassadeur (héraut) |
| `moderator` | Modérateur |
| `admin` | Administrateur — accès aux outils de debug (slider d'influence, recharge énergie) |

---

## Résumé des constantes

| Paramètre | Valeur |
|-----------|--------|
| Énergie max | 5 |
| Cycle de régénération | 4h (14 400s) |
| Régénération de base | 1 pt/cycle |
| Bonus régénération | +1 pt / 3 lieux revendiqués |
| Proximité GPS gratuite | 500m |
| Coût découverte (faction) | 0.5 pt |
| Coût découverte (standard) | 1 pt |
| Score : poids like | ×1 |
| Score : poids vue | ×0.1 |
| Score : poids exploration | ×2 |
| Rayon territoire min | ~150m |
| Historique notifications | 7 jours |
