# V0.7 — MVP ECO Merveille (3 features)

> **Statut** : design validé Uriel le 2026-05-01.
> **Cible** : livraison stable avant **ECO Merveille** (~2026-05-12, soit ~10 jours).
> **Scope** : MVP minimum pour faire sentir une nouveauté sociale au festival sans refonte profonde. Le sous-spec Campement complet reste suspendu jusqu'à mi-mai (cf. méta-spec [`2026-05-01-v07-articulation-campement-quetes-influence-design.md`](2026-05-01-v07-articulation-campement-quetes-influence-design.md)).

---

## 1. Contexte & motivation

ECO Merveille est un festival où Runes de Chêne sera présent dans ~10 jours. Uriel veut profiter de l'événement pour livrer une nouveauté visible côté communauté, mais sans rusher le sous-spec Campement complet (Voronoi pondéré, mur de threads, mode nomade complet, déplacement avec coût Couronnes — qui demanderaient 3-4 semaines de dev sérieux).

**3 livrables qui prennent ~7 jours de dev et qui livrent 80% du ressenti "Campement" pour les festivaliers :**

1. **Toggle "Brouiller mes pistes"** — option de confidentialité GPS, randomisation dans un rayon de 50 km (terre uniquement). Rassure les nouveaux joueurs au stand.
2. **Note partagée sur le profil** — chaque joueur peut poser un petit mot visible par les autres. Cœur social.
3. **Avatars offline persistants** — les joueurs déconnectés restent visibles à leur dernière position en **gris**, au lieu de disparaître. Donne le sentiment d'une carte vivante en permanence.

---

## 2. Décisions stratégiques (résumé)

| Décision | Choix retenu | Raison |
|---|---|---|
| Scope V0.7 ECO Merveille | **3 features minimum** (toggle + note + offline gris) | Pareto livrable en 10 jours |
| Système de Campement complet | **Suspendu** jusqu'après ECO Merveille | Demande 3-4 semaines de dev sérieux |
| Imprécision GPS | **Toggle on/off binaire** (pas de 3 paliers) | Simplicité maximum, suffisant pour rassurer |
| Rayon de brouillage | **50 km** autour de la position réelle | Suffisamment large pour anonymiser, suffisamment local pour rester crédible |
| Brouillage dans l'eau | **Interdit** — retry jusqu'à terre ferme | Pas de joueur affiché au milieu de l'océan |
| Position offline | **Persistante** (dernière position de déconnexion), avatar **gris**, **TTL 24h** après inactivité | Évite que la carte se vide en soirée + évite la pollution de comptes longuement inactifs |
| Refonte modale profil | **NON** pour ECO Merveille | Le `PlayerProfileModal` reste tel quel, juste augmenté de la note partagée |
| Bandeau de présence | **NON** pour ECO Merveille | Reporté avec le sous-spec Campement complet |

---

## 3. Feature 1 — Toggle "Brouiller mes pistes"

### 3.1 UX

- **Position** : dans les paramètres utilisateur (icône engrenage / écran profil)
- **Label** : "Brouiller mes pistes"
- **Description courte** : *« Pour préserver ton intimité, ta position affichée aux autres veilleurs est aléatoire dans un rayon de 50 km autour de toi. Activé par défaut. »*
- **État par défaut** : **activé** (privacy-by-default — décision prudente compte tenu du public ECO Merveille avec beaucoup de premières découvertes)
- **Toggle binaire** : on / off

### 3.2 Logique

- **Si activé** : la position aléatoire est calculée **une seule fois au lancement de l'app** (login ou ouverture d'une session active). Elle reste **fixée pendant toute la session** — pas de recalcul à chaque update GPS. L'avatar reste donc à un endroit stable de 50 km autour du joueur, plus crédible et moins désagréable visuellement.
- **Si désactivé** : position GPS réelle, mise à jour normalement comme aujourd'hui.
- **Si l'utilisateur active/désactive en cours de session** : effet immédiat — un nouveau tirage aléatoire est fait au moment du toggle. Cette nouvelle position floutée est ensuite stable jusqu'à la prochaine relance.
- **Si l'utilisateur n'a pas autorisé le GPS** : pas de position publique du tout — il n'apparaît pas sur la carte. La modale de son profil reste accessible mais sans indication de position. Important pour ECO Merveille où beaucoup s'inscrivent au stand sans avoir encore activé la géoloc.

**Justification "fixée au lancement"** : Uriel le 2026-05-02. Si la position floutée saute toutes les 30 sec, ça donne un effet "fantôme qui clignote" peu crédible. En la figeant à l'ouverture de session, le joueur apparaît comme étant *« dans cette zone »* de manière stable. Acceptable même s'il se déplace réellement de 5-10 km dans la session — au pire la position floutée n'est plus dans le bon cercle de 50 km, mais c'est peu visible.

### 3.3 Contrainte technique : pas dans l'eau

La position randomisée doit être sur **terre ferme**.

**Approche recommandée** : utiliser PostGIS (déjà actif sur Supabase) avec un dataset de **landmasses** importé une fois (Natural Earth `ne_50m_land`, gratuit, ~3 MB). Fonction utilitaire `is_on_land(lat, lng)` qui retourne `true`/`false`.

Algorithme côté serveur (RPC `randomize_position_on_land`) :
1. Générer un point aléatoire dans le disque de 50 km autour de `lat, lng` (distribution uniforme — cf. https://stackoverflow.com/a/50746409 pour la formule)
2. Si `is_on_land(rand_lat, rand_lng)` → retourne le point
3. Sinon retry, max 15 tentatives
4. Si toutes échouent (cas extrême : île minuscule entourée d'océan) → retourne la position GPS réelle (fail-safe : mieux vaut afficher la vraie que rien)

**Performance** : la randomisation est faite côté serveur à la mise à jour de position, donc ~1× par 30 sec par utilisateur actif. Largement supportable.

### 3.4 Stockage

Nouvelle colonne sur `users` :
```sql
ALTER TABLE users ADD COLUMN brouiller_pistes boolean NOT NULL DEFAULT true;
```

La position GPS *réelle* du joueur (pour la fonctionnalité GPS de découverte de lieux) reste stockée privée et utilisée uniquement pour les vérifications GPS — non exposée aux autres joueurs.

La **position publique** affichée (en propre ou floutée) est calculée au moment de l'envoi et stockée dans la colonne existante de position publique (à confirmer : `users.last_known_lat/lng` ou équivalent — à vérifier dans le code lors du dev).

---

## 4. Feature 2 — Note partagée sur le profil

### 4.1 UX

- **Position** : sur la modale `PlayerProfileModal` (existante), un nouveau champ visible en haut (sous le nom, avant les stats) — placé à un endroit qui ne décale pas la structure existante.
- **Label affiché** : un petit mot stylé italique parchemin, lisible.
- **Édition** : si c'est ton propre profil, un crayon ✏️ permet d'éditer le mot inline. Sauvegarde au blur ou au clic ailleurs.
- **Si la note est vide et c'est ton profil** : un placeholder "✏️ Laisse un mot…" en italique grisé.
- **Si la note est vide et c'est un autre profil** : la zone n'apparaît pas du tout (pas de blanc gênant).

### 4.2 Stockage

```sql
ALTER TABLE users ADD COLUMN profile_note text;
ALTER TABLE users ADD COLUMN profile_note_updated_at timestamptz;
-- Limite côté code : 200 caractères max
```

### 4.3 Modération

- **Limite stricte 200 caractères** côté front et back (anti-spam, anti-pavé)
- **Pas de filtre IA** (sur-engineering pour 10 jours)
- **Bouton "Signaler"** sur la modale d'un autre profil → le signalement va dans une table `profile_note_reports` ou s'enregistre dans le log admin existant (à voir avec l'archi du Hub actuel)
- **Action admin Hub** : reset la note (force vide) + ban temporaire de la fonction "note"

### 4.4 Visibilité côté carte

**Pas de note flottante sur la carte au-dessus de l'avatar** pour ce MVP. Le mot ne s'affiche **que** dans la modale du profil. Cohérent avec le scope MVP : pas de bandeau de présence, pas de médaillon riche sur la carte.

---

## 5. Feature 3 — Avatars offline persistants (en gris)

### 5.1 UX

- Quand un joueur ferme l'app ou se déconnecte, son avatar reste **visible sur la carte** à sa **dernière position de déconnexion**.
- Visuellement, l'avatar passe en **gris désaturé** (CSS `filter: grayscale(0.85) brightness(0.85);` ou équivalent), avec opacité légèrement réduite.
- **Pas de pastille verte** "en ligne" pour les offline (était présente quand connecté).
- **Au tap** : la modale du profil s'ouvre normalement, sans pastille en ligne, et avec l'indication *« Vu il y a X jours »* placée sous le nom du joueur (à côté de l'héritage / faction).

### 5.2 TTL 24h après inactivité

L'avatar gris reste à sa dernière position **pendant 24h max** après la déconnexion. Au-delà, il **disparaît complètement** de la carte jusqu'à la prochaine connexion du joueur.

**Justification** (Uriel le 2026-05-02) : on évite que la carte se peuple de comptes inactifs depuis des semaines. 24h c'est large — un joueur qui se reconnecte le lendemain matin retrouvera sa présence. Au-delà, c'est un compte qui s'est éloigné, on libère la carte.

**Logique technique** : côté requête de la carte, on filtre `last_seen_at >= NOW() - INTERVAL '24 hours'`. C'est une condition WHERE simple, pas de cron de cleanup.

### 5.3 Logique technique

- Lors du sign-out / fermeture d'app : la dernière position est stockée comme `last_seen_position` avec un timestamp `last_seen_at`.
- Côté carte : on récupère **tous les utilisateurs** (pas seulement les connectés) avec leur position publique + statut online/offline + `last_seen_at`.
- Côté front : si offline, on applique le filtre gris.

Côté DB :
```sql
-- À vérifier ce qui existe déjà — sinon ajouter :
ALTER TABLE users ADD COLUMN last_seen_at timestamptz;
ALTER TABLE users ADD COLUMN last_seen_lat double precision;
ALTER TABLE users ADD COLUMN last_seen_lng double precision;
```

---

## 6. Architecture & dépendances

### 6.1 Migrations SQL nécessaires

À ajouter dans `supabase/migrations/` (numéros à incrémenter à partir du dernier en prod) :

1. **mig N+1** : ajout colonne `users.brouiller_pistes`
2. **mig N+2** : ajout colonne `users.profile_note` + `users.profile_note_updated_at`
3. **mig N+3** : ajout colonnes `users.last_seen_at` + `users.last_seen_lat` + `users.last_seen_lng` (si pas déjà présentes)
4. **mig N+4** : import du dataset Natural Earth `ne_50m_land` dans une table `landmasses` + fonction PostGIS `is_on_land(lat, lng)`
5. **mig N+5** : RPC `update_user_position(p_lat, p_lng)` qui :
   - Si `brouiller_pistes = true` : génère une position randomisée dans 50 km, vérifie qu'elle est sur terre, retry jusqu'à 15× sinon fallback position réelle
   - Met à jour `last_seen_*`, `last_seen_at`
6. **mig N+6** : RPC `set_profile_note(p_note)` (validation longueur ≤ 200, update `profile_note_updated_at`)
7. **mig N+7** : refonte de la RPC qui retourne les positions des joueurs pour la carte → inclut les offline avec leur `last_seen_*` et un flag `is_online`

### 6.2 Frontend

- `apps/explore-web/` :
  - Nouveau composant ou section dans paramètres pour le toggle "Brouiller mes pistes"
  - Nouveau champ "Note" dans `PlayerProfileModal.tsx` (édition inline pour soi, lecture pour autres)
  - Refonte du composant qui affiche les avatars sur la carte → support du mode gris pour offline
  - Liaison du `last_seen_at` côté store

### 6.3 Hub

- Pas de chantier obligatoire pour ECO Merveille
- Si on a le temps : ajouter une vue "Notes signalées" dans le Hub admin

### 6.4 Tests

- Test manuel sur mobile : toggle "Brouiller" → position floutée
- Test manuel : poser une note → visible par d'autres comptes
- Test manuel : se déconnecter → avatar reste en gris
- Vérifier que la randomisation ne tombe jamais dans l'eau (5-10 essais à différents endroits côtiers)

---

## 7. Risques & atténuations

| Risque | Atténuation |
|---|---|
| **Dataset Natural Earth lourd à importer** | C'est ~3 MB. PostGIS gère sans problème. Une fois importé, c'est statique. |
| **Performance randomisation côté serveur** | RPC simple, ~1× par 30 sec par user actif. Largement OK. |
| **Note inappropriée publiée** | Limite 200 char + bouton signaler + reset admin. Pas de filtre IA (sur-engineering 10 jours). |
| **Carte qui devient illisible avec les offline persistants** | Mitigé par le TTL 24h après inactivité (cf. §5.2) : seuls les joueurs vus dans les dernières 24h apparaissent en gris. Au-delà, ils disparaissent de la carte. |
| **Conflit avec le sous-spec Campement complet futur** | Aucun : les 3 features ici sont des prérequis ou des compléments du Campement complet. La note partagée deviendra le mécanisme du "Mur" plus tard, le toggle "Brouiller" sera potentiellement remplacé par les 3 paliers + mode nomade, etc. |
| **Délai 10 jours trop tendu** | Si on ne peut pas tout livrer, ordre de priorité : (1) note partagée (cœur social), (2) toggle brouiller (privacy), (3) offline persistant (bonus). On peut sacrifier (3) en derniers recours. |

---

## 8. Calibration de l'effort (estimation)

| Tâche | Effort |
|---|---|
| Migrations SQL (1 à 7) | ~1.5 jour |
| Import dataset Natural Earth + fonction PostGIS | ~0.5 jour |
| RPC `update_user_position` avec randomisation et retry | ~0.5 jour |
| RPC `set_profile_note` + RPC retour des joueurs (refonte) | ~0.5 jour |
| Frontend : toggle Brouiller dans paramètres | ~0.5 jour |
| Frontend : champ Note dans PlayerProfileModal | ~1 jour |
| Frontend : avatars offline en gris + last_seen | ~1 jour |
| Tests + bug fixing + édition de migrations | ~1.5 jour |
| Deploy Netlify + smoke test prod | ~0.5 jour |
| **Total** | **~7 jours** |

Marge **~3 jours** pour les imprévus avant ECO Merveille.

---

## 9. Lien avec le sous-spec Campement complet

Ce mini-spec MVP ne **remplace pas** le sous-spec Campement complet — il est un préalable simplifié.

Quand on reprendra le sous-spec Campement (post-ECO Merveille, ~mi-mai) :

| Feature MVP P0 | Devient quoi en V0.7.X+1 |
|---|---|
| Toggle "Brouiller mes pistes" | Remplacé par les 3 paliers d'imprécision + mode nomade configurable |
| Note partagée sur le profil | Devient la "Note du moment" / "Mot du moment" du Campement, intégrée au Mur |
| Avatars offline en gris | Devient la couche "présence" du système Campement, complétée par traces GPS récentes 7j et bandeau de présence |

Aucune migration de données nécessaire entre les deux : les colonnes `brouiller_pistes`, `profile_note`, `last_seen_*` peuvent rester. Le V0.7.X+1 ajoutera, ne supprimera pas.

---

## 10. Annexes

### 10.1 Décisions explicites de simplification (rejetées pour le MVP)

- ❌ 3 paliers d'imprécision (Précis/Discret/Région) → remplacé par toggle binaire
- ❌ Refonte de la modale profil en "Campement" avec atmosphère parchemin → repoussé au sous-spec complet
- ❌ Bandeau de présence avec scroll auto → repoussé au sous-spec complet
- ❌ Punaise rouge sur la note → repoussé (la note actuelle utilise le style existant du profil)
- ❌ Mur de messages avec threads → repoussé
- ❌ Notifications push pour les notes → repoussé

### 10.2 Conditions de succès ECO Merveille

- ≥ 80% des nouveaux joueurs au stand activent le toggle "Brouiller mes pistes" (= privacy-by-default valide)
- ≥ 30% des joueurs actifs posent une note dans la première semaine (= cœur social marche)
- 0 incident de signalement de note (= modération a posteriori suffit dans la communauté actuelle)
- Carte visiblement plus vivante (avatars persistants offline en gris)

### 10.3 Références

- Méta-spec V0.7 articulation : [`2026-05-01-v07-articulation-campement-quetes-influence-design.md`](2026-05-01-v07-articulation-campement-quetes-influence-design.md)
- Bible Game Design : `~/citadelle/📱 L'application (La Carte)/🎮 Bible Game Design.md`
- Préférences Uriel : `~/citadelle/📱 L'application (La Carte)/Préférences Uriel.md`
- Natural Earth land dataset : https://www.naturalearthdata.com/downloads/50m-physical-vectors/
