# Home mobile = Hub des 3 raisons de revenir — Design

**Date :** 2026-05-09
**Auteur :** Uriel + XO
**Statut :** Design validé par Uriel le 9 mai 2026, prêt pour le plan d'implémentation
**Branche cible :** nouvelle branche depuis `main` (nom à confirmer dans le plan, ex. `home-pivot-v2`). La branche `home-pivot` originale est conservée en local et sur `origin` comme archive — ses commits utiles seront repris ou réécrits sur la nouvelle branche.

---

## 1. Contexte

La home-page mobile a été tentée le matin du 9 mai sur la branche `home-pivot` (25+ commits feats), puis abandonnée le même jour. Constat de l'abandon (cf. mémoire `project_home_pivot_tentee_9mai.md`) : la rétention vient des raisons de revenir, pas d'un nouvel écran d'entrée.

**Ce qui a changé en 8h :** Uriel a clarifié le cadre d'usage de l'app autour de **3 raisons de revenir** (mémoire `project_boussole_3_raisons.md`) : *le rituel, le lien, l'aventure*. La home n'est plus pensée comme un menu/dashboard, mais comme **le hub matérialisé de ces 3 piliers en un écran**. Esthétique Chevalier Errant validée par humains externes sur la nouvelle maquette d'Uriel.

Ce design ressuscite les composants déjà construits sur `home-pivot`, abandonne le split-view desktop, et ajoute deux pages plein écran (Chat, Activité) pour donner aux piliers "lien" leur propre scène.

---

## 2. Périmètre

### Inclus

- Route `/accueil` (mobile-only) — home hub des 3 piliers
- Route `/chat` (mobile-only) — page plein écran réutilisant `ChatPanel`
- Route `/activite` (mobile-only) — page plein écran réutilisant `ActivityFeed`
- `MobileTopBar` partagé entre `/accueil` et `/carte` (mobile)
- `MobileStatsBar` partagé entre `/accueil` et `/carte` (mobile)
- Navbar mobile à 5 cellules (`Accueil • Chat • + • Activité • Carte`)
- Atterrissage post-login : mobile → `/accueil`, desktop → `/carte` (inchangé)
- Nettoyage de la branche `home-pivot` : suppression du `MainShell` desktop split-view et du mode `PlacePanel` in-panel

### Exclus

- **DM joueur-joueur** (1-to-1) — hors scope, sprint futur
- **Modifications du contenu de `ChatPanel`** — l'onglet Chat ouvre l'existant tel quel (3 canaux : général, faction, bugs + accès chats d'expéditions)
- **Pivot desktop** — la `/carte` reste la racine et le HUD desktop est inchangé

---

## 3. Architecture

### 3.1 Routes & redirections

```
/                  → mobile : redirige /accueil   ; desktop : redirige /carte
/accueil           → mobile uniquement (sur desktop : redirige /carte)
/carte             → toutes plateformes (racine desktop)
/chat              → mobile uniquement (sur desktop : redirige /carte avec ChatPanel ouvert)
/activite          → mobile uniquement (sur desktop : redirige /carte)
```

La détection mobile/desktop suit le pattern existant (`mobileNavStore` ou matchMedia, à confirmer dans le plan d'implémentation).

### 3.2 Composants partagés mobile

#### `MobileTopBar`
- Logo Runes de Chêne (gauche)
- Spacer flex
- Icône 🏪 boutique → ouvre Shopify dans un nouvel onglet
- `NotificationBell` (cloche) — composant existant
- `ProfileMenu` (avatar) — composant existant
- Présent sur `/accueil` (fond uni) et `/carte` (avec dégradé qui fond vers la carte)

#### `MobileStatsBar`
- 3 stats horizontales : **Niveau** (avec XP) · **Énergie** (`⚡ X/Y`) · **Couronnes** (`🪙 N`)
- Réutilise les composants existants : `StatsBar`, `EnergyIndicator`, `CrownsBadge`
- Présent sur `/accueil` et `/carte` (mobile uniquement)
- Pas de Coupe ni Gloire dans la StatsBar (ces métriques restent dans le profil)

#### Dégradé sur `/carte` mobile
- Sur `/carte`, `MobileTopBar` + `MobileStatsBar` sont posées par-dessus la carte MapLibre
- Un dégradé CSS `linear-gradient(180deg, rgba(14,14,14,1) 0%, rgba(14,14,14,1) 80%, rgba(14,14,14,0) 100%)` fond le bandeau vers la carte sur ~16-20px en bas, pour ne pas casser l'immersion cartographique
- L'ancien bouton flottant "Visiter la Boutique officielle" sur `/carte` mobile est supprimé (remplacé par 🏪 dans la topbar)

### 3.3 Page `/accueil` — ordre du scroll

1. **`MobileTopBar`** — sticky en haut, toujours visible au scroll
2. **`MobileStatsBar`** — scrolle avec le contenu (pas sticky)
3. **Énigmes du jour** — `DailyEnigmaCard` + `EnigmaFragmentsList` compactée (commits existants `21dfff0` et `689164d`/`fc85126` de home-pivot)
4. **Événements & Quêtes** — `QuestsBoardPanel` embed (existant V0.7+, livré 6 mai)
5. **Lieux récents** — `PlacesSection` (carrousel horizontal Nouveaux/Proches, commits `642b57d` et `bfdcad1` de home-pivot)
6. **Teaser Activité** — 3 dernières lignes de l'`ActivityFeed` + lien `Voir tout →` qui pousse vers `/activite`
7. **`BottomTabbar`** (fixe en bas)

**Pas de `FragmentsCarousel`** dans le scroll de `/accueil` (commit `b9a1dec` de home-pivot **non repris** sur la nouvelle branche). Si un besoin de mise en avant des fragments narratifs émerge plus tard, on en rediscutera dans un brainstorming dédié.

**Pas d'animations de transition** entre onglets ou pages — comportement React Router standard. Si le besoin émerge à l'usage, c'est un ajout polish indépendant.

### 3.4 Page `/chat` (mobile)

- Wrapper `ChatPage` plein écran qui réutilise `ChatPanel.tsx` existant
- Sur mobile, `ChatPanel` n'est plus monté sur `/carte` (suppression du panel flottant pour éviter doublon)
- Sur desktop, `ChatPanel` reste en panel flottant sur `/carte` (inchangé)
- Affiche les 3 canaux (général, faction, bugs) + accès aux chats d'expéditions actifs
- Pas de modification des `RPCs` ni du `chatStore`

### 3.5 Page `/activite` (mobile)

- Wrapper `ActivityPage` plein écran qui réutilise `ActivityFeed.tsx` (commit `0332e91` de home-pivot)
- Affiche les ~30 derniers events narratifs filtrés (`activity_log`)
- Possibilité (à creuser dans le plan) de filtres par type : mécénats / brouillard / connexions / fragments

### 3.6 Navbar mobile (`BottomTabbar`)

```
┌─────────────────────────────────────────────────────────────┐
│  [🏠 Accueil]  [💬 Chat (●)]  [+]  [🔔 Activité (●)]  [🗺️ Carte]  │
└─────────────────────────────────────────────────────────────┘
```

- 5 cellules + FAB central (le `+` en bouton flottant doré)
- `+` ouvre `BottomTabbarPlusMenu` existant (réutilise `CreateMenu`)
- Badges rouges de non-lus sur **Chat** et **Activité** — moteurs de retour psychologique
- Le `ProfileMenu` reste dans `MobileTopBar` (pas d'onglet Profil dans la navbar)

---

## 4. Backend

### 4.1 Mig 140 (déjà déployée, dort en prod)

- `get_recent_fragments(p_user_id, p_limit)` — utilisée par `FragmentsCarousel`
- `get_recent_places(p_user_id, p_limit)` — utilisée par `PlacesSection` (Nouveaux)
- `get_nearby_places(p_user_id, p_lat, p_lng, p_limit)` — utilisée par `PlacesSection` (Proches)

→ Aucune nouvelle migration SQL requise pour ce chantier.

### 4.2 RPCs touchées

Aucune. Tous les composants réutilisent des RPCs existantes (`get_today_quests_state`, `get_my_expeditions`, `chat_send_message`, `get_chat_messages`, etc.).

---

## 5. Composants à créer / adapter / supprimer

### À créer

- `MobileTopBar.tsx` (extraction depuis `HomePage.tsx` de home-pivot)
- `MobileStatsBar.tsx` (wrapping de `StatsBar` existant pour usage partagé)
- `ChatPage.tsx` (wrapper plein écran de `ChatPanel`)
- `ActivityPage.tsx` (wrapper plein écran de `ActivityFeed`)

### À adapter

- `BottomTabbar.tsx` (passer de 3 cellules à 5 cellules + FAB)
- `MapPage.tsx` mobile : monter `MobileTopBar` + `MobileStatsBar` en haut, retirer `ChatPanel` flottant, retirer ancien bouton "Visiter la Boutique"
- `App.tsx` (router) : ajouter routes `/accueil`, `/chat`, `/activite` ; logique de redirection mobile/desktop sur `/`

### À supprimer (de la branche home-pivot)

- `MainShell.tsx` (desktop split-view)
- Mode `in-panel` de `PlacePanel`
- Mounts conditionnels d'`ExpeditionsHud` et `GameToast` introduits par les commits `52888ca` et `ec43227` (le HUD reprend son comportement standard sur desktop)

---

## 6. Out of scope (rappel explicite)

- DM joueur-joueur 1-to-1
- Refonte du contenu de `ChatPanel`
- Modifications du HUD desktop de `/carte`
- Animations / micro-interactions au-delà du standard
- Refonte visuelle des composants enfants (`DailyEnigmaCard`, `QuestsBoardPanel`, etc.)
- Nouveaux types de notifications push liés à la home

---

## 7. Critères de succès

- Login mobile → utilisateur atterrit sur `/accueil` avec ses 3 piliers visibles en 1 scroll
- Login desktop → utilisateur atterrit sur `/carte` (comportement inchangé)
- Sur mobile, navigation vers `/chat` et `/activite` accessible en 1 tap depuis n'importe quelle page
- Header (`MobileTopBar` + `MobileStatsBar`) cohérent visuellement entre `/accueil` et `/carte` mobile
- Aucune régression sur le chat existant, les expéditions, les énigmes, les couronnes
- Branche `home-pivot` originale préservée en local (sécurité)
