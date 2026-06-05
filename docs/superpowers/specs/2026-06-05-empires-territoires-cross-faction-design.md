---
zone: app-gamedesign
tags: [gamedesign, territoires, empires, factions, cour, racine-app]
status: design validé
last-verified: 2026-06-05
---

# 🏛️ SPEC — Les Empires (territoires cross-faction)

> Rédigée le 5 juin 2026 — Uriel + XO
> Zone : game design (explore-web + Supabase)
> Statut : **design validé** — prêt pour plan d'implémentation
> Rattaché à : `🏛️ SPEC - Les 4 Maisons (Factions) V1`, `🎮 Bible Game Design`, La Cour (V0.7)

---

## Résumé (le job-to-be-done)

**Observation terrain** : depuis La Cour (V0.7), on peut investir des Couronnes pour **soutenir un autre joueur** (le veilleur d'un lieu, ou un challenger). Les joueurs nouent donc spontanément des **alliances personnelles, souvent cross-faction** — un Garde Boréale et un Bâtisseur d'Airain se soutiennent sur un coin de carte. **Les Maisons sont devenues des classes** (un style de jeu) ; par-dessus émerge une **couche humaine, locale, territoriale** qu'on ne nomme ni n'outille encore.

**Objectif** : **encourager** ce regroupement émergent en lui donnant une **identité** (nom + bannière ancrés à la terre) et un **intérêt de gameplay**.

**Principe de design fondateur** : *l'identité suit le comportement.* On ne crée pas une « page Créer une guilde » vide ; on **détecte** une bande qui tient un territoire ensemble, et on lui offre de se baptiser. Le badge récompense un lien qui existe déjà.

---

## Les deux couches du jeu (à ne pas confondre)

```
  FACTION / MAISON  →  ta CLASSE : comment tu joues, ta couleur, ton style.
                       Compétition GLOBALE = la Coupe des Héritages.
  ─────────────────────────────────────────────────────────────────────
  L'EMPIRE (nouveau) →  des VRAIS GENS, souvent cross-faction, qui tiennent
                       un cluster de lieux ensemble. Coopération LOCALE,
                       personnelle, territoriale. Calque ORTHOGONAL à la Coupe.
```

Un lieu reste « bleu » pour la Coupe **et** peut appartenir à « La Marche des Trois Chênes ». Les deux coexistent sans se gêner.

---

## On fait ÉVOLUER l'existant, on ne reconstruit pas

Il existe déjà un système de **nommage de territoire par vote** (V0.7) :
- `TerritoryPanel.tsx` + RPCs `propose_territory_name` / `vote_territory_name` / `get_territory_votes` (mig 013, helpers réparés mig 100-103).
- Un territoire = un **blob** de lieux (cluster), avec `customName` ou « Nom incertain ».
- **Le poids de vote est DÉJÀ au prorata des Couronnes** : `votePower = 1 base + 1/lieu veillé + bonus Couronnes` (`_user_blob_influence` = somme du mécénat `side='defense'` ; seuil `territory_vote_per_influence`, défaut 10🪙 = +1 voix).

⚠️ **Deux limites à lever :**
1. Le nommage est aujourd'hui **gaté par la Maison dominante** (« Rejoignez la faction X pour voter »). → **À dé-gater** : tous les investisseurs peuvent nommer, quelle que soit leur Maison.
2. Le composant est marqué **« TODO À VIRER » au profit du « Campement »** (entité géolocalisée mono-couleur). → Cette spec **remplace** la piste Campement par les Empires (cross-faction). À acter explicitement.

---

## Les 3 états d'un territoire

```
  NEUTRE  ───────►  MARCHE DE MAISON  ───────►  EMPIRE
  (Nom incertain)   (couleur de Maison)         (nommé + bannière)
   < seuil          dominé prorata              ≥ 100🪙 + 5 lieux reliés
                    par une Maison                   │
                                                     ├─ dominé 1 Maison → couleur Maison
                                                     └─ équilibré       → OR (cross-faction)
```

---

## Fonder un Empire

**Seuil de fondation (débloque nom + bannière)** — identique pour tous :
- **≥ 100 Couronnes investies en commun** sur le cluster (le puits collectif = le coût de fondation ; pas de taxe séparée).
- **≥ 5 lieux RELIÉS** (contigus, un seul tenant — pas 5 lieux éparpillés).

Quand le cluster franchit le seuil → **notification** : *« Vous pouvez fonder un Empire. »* Un investisseur formalise (nom + bannière). C'est le modèle d'émergence **« détecté → couronné »** : le système révèle la bande, un acte humain la baptise.

**Nommage** : système de vote existant, **pondéré au prorata des Couronnes**, mais **dé-gaté** (tous les investisseurs, toutes Maisons confondues).

---

## La couleur OR — la distinction cross-faction

La couleur de l'Empire dépend **uniquement du prorata des investisseurs**, pas du seuil de fondation :

- **Dominé par une Maison** → l'Empire porte la **couleur de cette Maison**.
- **Équilibré cross-faction** → **OR**, à condition (anti-jeton, prorata strict, sur le poids investi = Couronnes mécénat défense + veille) :
  - la Maison la plus forte **≤ 55 %** du poids total, **ET**
  - **≥ 2 Maisons** pèsent chacune **≥ 20 %**.

→ Une Couronne adverse isolée (2 %) ne dore rien. L'or est une **vraie balance des pouvoirs** — la marque visible que des gens ont choisi l'alliance par-dessus la tribu. C'est la couche humaine *rendue visible sur la carte*.

---

## Permanence — l'Empire est un monument, pas un thermostat

**Pas de décroissance.** Fonder un Empire est un **acte permanent** : le nom + la bannière restent gravés, même si plus tard l'équilibre des Maisons change sur ces lieux. L'or n'est pas une lecture temps-réel de qui investit *maintenant* — c'est la **mémoire d'un moment où des gens se sont unis**.

Cohérent avec l'univers : le carnet de route, la mémoire, *« que rien de grand ne se perde »* (la Chevauchée du Crépuscule). La carte devient l'**histoire vivante des alliances de la communauté**, comme les vrais noms de lieux persistent sur une carte réelle.

> Conséquence actée : la carte accumule des monuments au fil du temps. C'est une **force** (patrimoine communautaire), pas un bug. Option future *(non v1)* : distinguer visuellement un Empire « vivant » d'un Empire « historique » — **sans jamais le supprimer**.

---

## Affichage carte (à détailler au plan)

- L'Empire s'affiche **près du/des Veilleur(s)** du cluster, avec **nom + bannière**, pour que les joueurs puissent **venir le soutenir** (recrutement de mécènes).
- Calque visuel distinct de la couleur de Maison (contour + libellé + blason).
- Or = traitement visuel premium réservé aux Empires cross-faction.

---

## Pilier « à terme » — Bonus de faction Attaque / Défense → le moteur de la fusion

Pour donner un **intérêt mécanique** (et pas seulement de prestige) à l'union cross-faction : chaque Maison reçoit des **forces complémentaires** à la Cour. Une bande cross-faction devient alors **mécaniquement plus complète** qu'une mono-Maison → la *raison de gameplay* de fusionner. Les rôles sont **déjà latents dans les archétypes** de la SPEC des 4 Maisons :

| Maison | Verbe / archétype | Rôle naturel à la Cour |
|---|---|---|
| 🔵 **Garde Boréale** | *« on ose »* — le Héros, la gloire | **Attaque** — le challenger qui prend les lieux |
| 🟢 **Pèlerins des Brumes** | *« on veille »* — le Mystique | **Défense** — le veilleur tient mieux |
| 🟣 **Chevauchée du Crépuscule** | *« on chevauche »* — l'errance | **Portée** — mécénat à distance, projeter sa force |
| 🔴 **Bâtisseurs d'Airain** | *« on rebâtit »* — le Souverain | **Économie** — rendement Couronnes, coût réduit |

Un Empire **complet** = attaquant + défenseur + projeteur + économe. Mono-Maison = bancal ; cross-faction = redoutable. **C'est le moteur de la fusion et de l'unité.**

→ **Post-v1**, à équilibrer finement avec la télémétrie. **Conçu dès maintenant dans la balance** pour que fondation d'Empire et bonus de Maison se renforcent au lieu de se gêner.

---

## Réglages (tous Hub-tunables, comme les coûts de distance)

| Paramètre | Valeur initiale |
|---|---|
| Couronnes en commun pour fonder | **100** |
| Lieux reliés pour fonder | **5** (contigus) |
| Plafond Maison dominante pour l'or | **≤ 55 %** |
| Plancher par Maison pour compter dans l'or | **≥ 20 %** (≥ 2 Maisons) |
| Couronnes → +1 voix de nommage | **10** (`territory_vote_per_influence`, existant) |

---

## Décisions actées

| # | Décision |
|---|---|
| 1 | Identité **ancrée à la terre** (territory-first), calque orthogonal à la Coupe. |
| 2 | On **fait évoluer** le système de nommage existant (vote prorata-Couronnes), on ne reconstruit pas. |
| 3 | Nommage **dé-gaté** : tous les investisseurs nomment, plus seulement la Maison dominante. |
| 4 | **3 états** : Neutre → Marche de Maison → Empire. |
| 5 | Fonder = **100🪙 en commun + 5 lieux reliés** → nom + bannière. |
| 6 | **OR** = équilibre cross-faction au prorata (top ≤ 55 %, ≥ 2 Maisons ≥ 20 %), jamais au jeton. |
| 7 | **Pas de décroissance** — l'Empire est **permanent** (monument). |
| 8 | Émergence **« détecté → couronné »** : notif au seuil, baptême par un humain. |
| 9 | **À terme** : bonus de Maison Attaque/Défense/Portée/Économie = moteur mécanique de la fusion. |
| 10 | Cette spec **remplace** la piste « Campement » référencée dans `TerritoryPanel.tsx`. |

## Questions ouvertes (pour le plan)

- Définition technique de **« 5 lieux reliés »** (adjacence Voronoi ? rayon ? graphe de proximité ?).
- **« En commun »** implique-t-il un nombre minimal de contributeurs distincts (≥ 2 ?) ou seulement le total de 100🪙 ?
- Migration du `TerritoryPanel` (déprécié) vers le nouveau flux Empire, et sort des RPCs `propose/vote_territory_name`.
- Affichage carte précis du calque Empire (contour, bannière, traitement or) — mockups à faire.
- Articulation Empire ↔ Coupe : un lieu doré compte-t-il encore pour une Maison dans la Coupe ? (a priori oui via la Gloire des membres, à confirmer).

---

## Historique

| Date | Changement |
|------|-----------|
| 5 juin 2026 | Création — Uriel + XO. Design validé section par section. |
