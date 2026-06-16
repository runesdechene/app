# Marque GPS (brouillon de lieu) — Design

> Statut : validé (brainstorming, 2026-06-16) — prêt pour plan d'implémentation
> App : explore-web
> Auteurs : Uriel + XO

## Problème

Beaucoup de joueurs visitent une ville sans avoir le temps de s'arrêter pour
créer un lieu complet (placer le pin, rédiger la description, prendre les
photos, choisir tags/époque). Résultat : ils repartent sans avoir capturé leur
présence physique, et perdent le **bonus de visite GPS** — qui est pourtant le
cœur sacré du jeu (*« L'app reste un pont vers le monde réel via la récompense
GPS »*, Décisions Game Design 2026).

## Principe (une phrase)

Un **jeton de présence privé** : le joueur pose un pin sur sa position GPS
réelle en un tap, sans rien rédiger. Plus tard, il transforme ce jeton en vraie
fiche de lieu et touche le **bonus visite GPS rétroactivement**, parce que la
marque prouve qu'il était bien là.

## Décisions structurantes (issues du brainstorming)

| # | Décision | Choix retenu |
|---|----------|--------------|
| 1 | Quand tombe la récompense GPS ? | **À la publication uniquement** (pas à la pose). Tue le farming par construction. |
| 2 | La marque réserve-t-elle le lieu ? | **Non.** Marque-page privé, le lieu reste ouvert. L'étendard se joue à la publication. |
| 3 | Capture à la pose | Pin + horodatage **obligatoires** ; photo(s) + titre d'une ligne **optionnels**. Le one-tap reste possible. |
| 4 | Péremption | **Douce** : jamais supprimée auto ; au-delà de ~30 j le **privilège GPS rétroactif s'éteint** (publication toujours possible, en « ajout à distance »). |
| 5 | Mécanisme de pose | **One-tap pur GPS** : la marque atterrit sur la position GPS réelle validée serveur, pas un viseur libre. Le pin exact s'ajuste à la publication (rayon serré). |
| 6 | Entry point | 3ᵉ entrée du `CreateMenu` (bouton `+`) : « Ajouter une marque GPS » + micro-explication. |
| 7 | Surface de gestion | **Marqueurs perso sur la carte** (visibles du propriétaire seul) + **badge HUD « 📍 X marques à compléter »** qui vole jusqu'à la plus proche. Pas d'écran liste dédié. |
| 8 | Collision à la publication | **Fusion intelligente** : si un lieu existe déjà là → pas de doublon, la marque s'enregistre comme **visite GPS sur le lieu existant** ; si le lieu est sans veilleur → **étendard planté à distance**. |
| 9 | Étendard rétroactif sur lieu existant | **Autorisé** (curseur « générosité »). |
| 10 | Accès à la pose | **Ouvert à tous**, même sous le seuil de découvertes. Le seuil ne s'applique qu'à la **publication** (comme `create_place` aujourd'hui). |
| 11 | Nom | « marque GPS » (clarté ; thématisation possible plus tard). |

## Cycle de vie

1. **Pose** — `+` → « Ajouter une marque GPS » → one-tap. Le serveur estampille
   **position GPS + horodatage** (la preuve). Mini-modale légère (≠ `AddPlaceFlow`)
   pour photo(s) et titre **optionnels**. **Aucune récompense.**
2. **Attente** — la marque vit sur la carte du propriétaire (visible de lui seul)
   + badge HUD `📍 X marques à compléter` → tap → vol carte vers la plus proche.
3. **Complétion** — tap sur la marque → ouvre `AddPlaceFlow` **pré-rempli**
   (position + photos + titre). Le joueur finit tags / description / époque,
   ajuste le pin exact (rayon serré), publie.
4. **Récompense à la publication** — lieu + carnet + **visite GPS rétroactive**
   + **étendard** (si le spot est libre).

## Collision à la publication

À la publication, check de proximité autour des coordonnées de la marque :

- **Lieu déjà présent** (dans le rayon de dé-doublonnage) → pas de doublon. La
  marque s'enregistre comme **visite GPS sur le lieu existant** (bonus visite
  conservé). Si le lieu est **sans veilleur** → **étendard planté à distance**.
- **Aucun lieu** → création normale via le flux `create_place`.

⚠️ Le rayon de dé-doublonnage doit gérer les **vrais lieux distincts proches**
(ex. deux chapelles à 40 m) — valeur à régler, configurable côté serveur.

## Péremption

- La marque n'est **jamais auto-supprimée** (pas de perte du travail du joueur).
- Au-delà de **~30 j** (configurable), le **privilège GPS rétroactif s'éteint** :
  la publication reste possible mais devient un **ajout à distance** (sans bonus
  visite, sans étendard).
- Un **push de rappel** peut être branché sur la stack push existante (non
  bloquant pour le V1).

## Anti-triche (cœur du système)

- **Zéro récompense à la pose** → le farming est impossible par construction
  (aucun point tant qu'il n'existe pas un lieu réel et conforme à la charte).
- À la publication, le bonus GPS (visite + étendard) n'est accordé **que si** :
  1. la marque **appartient au caller** ;
  2. elle a **≤ ~30 j** (fenêtre de fraîcheur) ;
  3. le **lieu final est à < ~200 m de la position enregistrée** dans la marque.
- Conséquence du point 3 : impossible de poser une marque à un endroit et de
  l'encaisser sur un lieu situé ailleurs.
- Niveau de confiance **identique à l'existant** : le client envoie déjà ses
  coordonnées GPS à `create_place` / `plant_flag`. On ne crée **pas** de nouvelle
  faille — la dérivation `isGps` passe simplement de « GPS live » à « GPS
  enregistré dans la marque ».

## Architecture technique (esquisse)

### Données

Nouvelle table `place_drafts` :

| Colonne | Type | Note |
|---------|------|------|
| `id` | uuid PK | |
| `user_id` | uuid FK users | propriétaire |
| `latitude` / `longitude` | double precision | position GPS validée à la pose |
| `accuracy_m` | numeric null | précision GPS reportée (rejet possible si trop mauvaise) |
| `created_at` | timestamptz | **horodatage-preuve** (server default now()) |
| `title` | text null | note d'une ligne optionnelle |
| `photos` | jsonb null | photos optionnelles (mêmes entrées que `create_place`) |
| `status` | text | `open` / `published` |
| `published_place_id` | uuid null FK places | lien une fois publiée |

**RLS : le propriétaire seul** peut lire / créer / modifier / supprimer ses
marques.

### RPCs

- **`create_gps_mark(p_user_id, p_lat, p_lng, p_accuracy)`** — insère la marque,
  `created_at` estampillé serveur. Position = GPS device (choix one-tap).
- **`publish_gps_mark(p_draft_id, …champs lieu…)`** *(ou extension de
  `create_place` acceptant `p_draft_id`)* — dérive `isGps` de la **marque** au
  lieu du GPS live, applique les 3 checks anti-triche, gère la collision
  (fusion/visite sur lieu existant vs création), marque le brouillon `published`
  et renseigne `published_place_id`.

### Photos

- Uploadées **dès la pose** vers `place-images/drafts/{userId}/…` (persistance
  cross-device pour finir depuis un autre appareil).
- Réutilisées à la publication (déplacement / référencement vers le lieu final).
- **Cron de nettoyage** des photos de marques supprimées ou périmées non
  publiées (à cadrer dans le plan).

### Front

- Nouvelle entrée `CreateMenu` (`components/map/controls/CreateMenu.tsx`) :
  `📍 Ajouter une marque GPS` + texte d'aide.
- **Mini-modale de pose** légère (nouveau composant), distincte de
  `AddPlaceFlow` : récupère le GPS frais (`getFreshPosition`), erreur explicite
  si localisation refusée, titre + photo optionnels, appel `create_gps_mark`,
  toast de confirmation.
- **Marqueurs perso** sur la carte (style distinct, visibles du propriétaire),
  tap → « Compléter / Supprimer ».
- **Badge HUD** `📍 X marques à compléter` → tap → vol carte vers la plus proche.
- **Pré-remplissage `AddPlaceFlow`** au lancement de la complétion (position,
  photos, titre déjà en place ; pin ajustable dans le rayon serré).

## Hors périmètre (V1)

- Écran liste dédié « Mes marques GPS » (choix : marqueurs carte + badge
  suffisent — les joueurs dézooment en permanence pour Couronnes/conquête).
- Décalage du pin à la pose (one-tap pur ; l'ajustement se fait à la publication).
- Thématisation du nom.

## Critères de validation

- Poser une marque ne crédite **aucun** point (Gloire / Coupe / Couronnes).
- Compléter une marque **< 30 j** dont le lieu final est **< 200 m** de la
  position enregistrée → crédite la **visite GPS** + l'**étendard** (si libre),
  en plus du lieu / carnet.
- Compléter une marque **> 30 j** → lieu créé en **ajout à distance**, **sans**
  bonus visite ni étendard.
- Publier sur un emplacement où un lieu existe déjà → **pas de doublon**, visite
  GPS enregistrée sur le lieu existant (+ étendard si non gardé).
- Tenter de publier un lieu à **> 200 m** de la marque → **pas** de bonus GPS.
- Une marque n'est visible **que** de son propriétaire (RLS).
