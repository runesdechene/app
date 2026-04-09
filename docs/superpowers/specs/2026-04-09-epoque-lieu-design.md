# Spec — Champ Époque sur les Lieux

> Date : 2026-04-09

## Contexte

Permettre de situer chaque lieu dans le temps via une époque (période historique) et une date précise optionnelle. Trois référentiels calendaires sont disponibles pour la saisie et l'affichage : Grégorien, Fondation de Rome (AUC), Chute de Constantinople. L'objectif est à la fois informatif et immersif — montrer que tout calendrier est arbitraire.

## Modèle de données

### Table `eras` (nouvelle)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | VARCHAR PK | Slug : `prehistory`, `bronze-age`, etc. |
| `name` | VARCHAR NOT NULL | Nom affiché |
| `year_start` | INTEGER | Borne début (Grégorien, négatif = av. J.-C.) |
| `year_end` | INTEGER | Borne fin |
| `sort_order` | SMALLINT NOT NULL | Ordre d'affichage chronologique |

### 11 périodes

| sort_order | id | name | year_start | year_end |
|---|---|---|---|---|
| 1 | `prehistory` | Préhistoire | NULL | -3300 |
| 2 | `bronze-age` | Âge du Bronze | -3300 | -1200 |
| 3 | `iron-age` | Âge du Fer | -1200 | -500 |
| 4 | `classical-antiquity` | Antiquité classique | -500 | 476 |
| 5 | `early-middle-ages` | Haut Moyen Âge | 476 | 1000 |
| 6 | `late-middle-ages` | Bas Moyen Âge | 1000 | 1453 |
| 7 | `renaissance` | Renaissance | 1453 | 1600 |
| 8 | `early-modern` | Époque moderne | 1600 | 1789 |
| 9 | `contemporary` | Époque contemporaine | 1789 | 1945 |
| 10 | `post-1945` | Monde post-1945 | 1945 | 2020 |
| 11 | `digital-era` | Ère digitale | 2020 | NULL |

### Colonnes ajoutées sur `places`

- `era_id` VARCHAR FK → `eras.id`, **nullable** (lieux existants restent NULL)
- `year_exact` INTEGER, **nullable** (année en calendrier Grégorien, négatif = av. J.-C.)

L'époque est obligatoire **à la création** (validé côté formulaire), mais nullable en base pour les lieux existants.

## Référentiels calendaires

Trois systèmes de datation, conversion purement front-end :

| Référentiel | Libellé UI | Formule |
|-------------|-----------|---------|
| Grégorien | Grégorien | valeur stockée directement |
| Romain | Fondation de Rome (AUC) | année Grégorienne + 753 |
| Byzantin | Chute de Constantinople | année Grégorienne − 1453 |

Le stockage en base est toujours en Grégorien. La conversion se fait à la saisie (référentiel → Grégorien avant INSERT) et à l'affichage (Grégorien → référentiel du lecteur).

Le toggle av. J.-C. / ap. J.-C. est masqué quand le référentiel est AUC (toujours positif pour les dates pertinentes du projet).

## UX — Formulaire de création (AddPlaceFlow Step 2)

Deux champs ajoutés après les tags :

### Sélecteur d'époque (obligatoire)
- Dropdown avec les 11 périodes, ordonnées par `sort_order`
- Chaque option affiche : nom + fourchette en gris (ex. "Antiquité classique — 500 av. J.-C. à 476")
- Pas de valeur par défaut → force le choix

### Date précise (optionnel, apparaît après choix d'époque)
- Champ numérique pour l'année
- Toggle av. J.-C. / ap. J.-C.
- Sélecteur de référentiel de saisie : Grégorien (défaut) | Fondation de Rome (AUC) | Chute de Constantinople
- Panneau "Équivalences" en temps réel : affiche la date convertie dans les 3 référentiels
- Validation non-bloquante : avertissement si la date ne tombe pas dans la fourchette de l'époque choisie

### RPC `create_place`
Ajouter les paramètres `p_era_id` (VARCHAR) et `p_year_exact` (INTEGER nullable).

## UX — PlacePanel (onglet Infos)

### Époque présente
- Ligne dans l'onglet Infos, même style que les autres champs
- Badge avec le nom de la période + date précise si renseignée
- La date est affichée dans le référentiel choisi par le lecteur (réglage global)

### Époque absente (lieux existants)
- Ligne cliquable "Ajouter une époque" — accessible à **tout joueur authentifié** (contribution collaborative, comme le carnet)
- Ouvre le sélecteur complet (dropdown époque + date optionnelle + référentiel de saisie)
- Sauvegarde directe via un UPDATE sur `places` (ou un RPC dédié)

## UX — Menu avatar

- Nouveau switch dans le menu déroulant avatar
- 3 options : Grégorien | Fondation de Rome (AUC) | Chute de Constantinople
- Stocké en `localStorage` (clé : `calendar-ref`, valeurs : `gregorian`, `auc`, `constantinople`)
- Appliqué partout dans l'app où une date d'époque est affichée

## Hors scope (versions futures)

- Filtres carte par époque
- Fourchette `year_from` / `year_to` (pour les lieux construits sur plusieurs décennies)
- Édition de l'époque depuis un mode édition complet du lieu
- Stockage du référentiel préféré en base (profil utilisateur)
