# Pivot Home-first — Design

> Date : 2026-05-09
> Branche cible : `home-pivot` (à créer)
> Auteur : Uriel + XO

## 1. Pourquoi

Aujourd'hui, l'app Runes de Chêne est carte-first : `/carte` est l'écran d'entrée, et tout (profil, fragments, faction, expéditions, énigme du jour, quêtes) vit en modals/overlays par-dessus la carte.

Constat utilisateur : **les gens veulent vivre l'expérience de la communauté Runes de Chêne avant de jouer à un jeu de carte**. Demande terrain forte (festival Echo & Merveilles 12 mai, communauté). La carte est le support, pas l'expérience principale.

Pivot : nouvelle page d'accueil `/accueil` qui devient le hub communautaire. La carte reste le cœur du gameplay mais devient une *destination* via tabbar bottom.

## 2. Architecture routing

```
/                  → LandingPage (publique, non-loggés — inchangé)
/accueil  (NEW)    → HomePage (loggés)
/carte             → MapPage (loggés — inchangé)
```

- Auth flow : après login, redirect `/accueil` (pas `/carte`).
- `/` redirect → `/accueil` si déjà loggé (sinon LandingPage).
- Back/forward navigateur fonctionne (vraies routes, pas un toggle de vue).

## 3. Layout HomePage (mobile-first)

```
┌─ <MobileHeader> ──────────────────────┐
│   🏰 Logo            🔔  👤[blason]    │  ← top sticky
├─ <StatsBar> ──────────────────────────┤
│  [Niv+Gloire] [Couronnes] [⚡Énergie] │  ← scroll-x si déborde
├─ <DailyEnigmaCard> ───────────────────┤
│   Énigme du jour — bandeau cliquable   │
├─ <QuestsBoardPanel /> ────────────────┤
│   (composant existant, embed)          │
├─ <FragmentsCarousel> ─────────────────┤
│   FRAGMENTS  ← [card][card][card]      │  ← scroll-x
├─ <PlacesSection> ─────────────────────┤
│   [Nouveaux] [Proches] tabs            │
│   Liste de lieux                       │
├─ <ActivityFeed> ──────────────────────┤
│   ⚔️ X a découvert Y                   │
│   🚩 Z a planté à W                    │
│   (30 derniers events filtrés)         │
├─ <BottomTabbar> ──────────────────────┤
│   [HOME]  (+)  [CARTE]                 │  ← position fixed
└────────────────────────────────────────┘
```

## 4. Composants — réutilisation et nouveau code

### 4.1 Réutilisation directe (pas de re-code)

| Composant existant | Usage dans la home |
|---|---|
| `MobileHeader` | Top bar (adapté pour fonctionner hors `/carte`) |
| `NotificationBell` | 🔔 dans top-right |
| `ProfileMenu` | 👤 dans top-right (menu Faction/Email/Brouillage/Logout) |
| `EnergyIndicator` | Cellule "Énergie" de la stats bar |
| `QuestsBoardPanel` | Embed direct dans la home (déjà conçu pour ce pattern, cf. spec §12.4) |
| `EnigmaChestButton` | Wrapped dans `DailyEnigmaCard` (style card pleine largeur) |

### 4.2 Nouveau code

**Frontend**
1. `HomePage.tsx` — orchestrateur de la page `/accueil`
2. `BottomTabbar.tsx` — barre fixe bottom (HOME ↔ CARTE + (+) central flottant)
3. `BottomTabbarPlusMenu.tsx` — menu contextuel du (+) (Ajouter événement / Ajouter lieu / extensible)
4. `StatsBar.tsx` — assembly horizontal des 3 cellules (Niv+Gloire / Couronnes / Énergie)
5. `HouseAvatarBadge.tsx` — badge Maison/Héritage superposé sur l'avatar du `ProfileMenu`
6. `DailyEnigmaCard.tsx` — card pleine largeur cliquable (wrapper de `EnigmaChestButton`)
7. `FragmentsCarousel.tsx` — carrousel horizontal des derniers fragments
8. `PlacesSection.tsx` — section avec tabs Nouveaux / Proches
9. `ActivityFeed.tsx` — fil persistant des activités narratives

**Backend (mig 140 unique)**

```sql
-- Carrousel Fragments
CREATE OR REPLACE FUNCTION get_recent_fragments(p_user_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (...) -- tri DESC sur fragments.created_at, marque owned/non-owned

-- Section Lieux — tab "Nouveaux"
CREATE OR REPLACE FUNCTION get_recent_places(p_limit INT DEFAULT 10)
RETURNS TABLE (...) -- tri DESC sur places.created_at, lieux validés uniquement

-- Section Lieux — tab "Proches"
CREATE OR REPLACE FUNCTION get_nearby_places(p_lat FLOAT, p_lng FLOAT, p_limit INT DEFAULT 10)
RETURNS TABLE (...) -- ordre par distance Haversine
```

**Adaptations**
- `App.tsx` — ajouter route `/accueil`, redirect `/` → `/accueil` si loggé
- `MobileHeader.tsx` — supporter mode "hors carte" (le logo ne reset pas le mapStore quand on est sur `/accueil`)

## 5. Composants détaillés

### 5.1 BottomTabbar

```tsx
<nav className="bottom-tabbar">
  <Link to="/accueil" className={isHome ? 'active' : ''}>
    <HomeIcon /> Accueil
  </Link>
  <button onClick={openPlusMenu} className="bottom-tabbar-plus">+</button>
  <Link to="/carte" className={isMap ? 'active' : ''}>
    <MapIcon /> Carte
  </Link>
</nav>
```

- `position: fixed; bottom: 0; left: 0; right: 0; z-index: 100`
- Hauteur ~64px + safe-area-inset-bottom pour iPhone notch
- Direction visuelle : **V3 parchemin patiné** (cf. §6)

### 5.2 BottomTabbarPlusMenu

Menu contextuel qui s'ouvre au tap (+) :
- Bottom sheet ou popover ancré sur le (+)
- Items : "Ajouter un événement" → ouvre `ExpeditionCreator`, "Ajouter un lieu" → ouvre `PlaceCreator`
- Extensible (futurs items à venir)
- Tap outside ferme

Remplace le FAB actuel de `ExpeditionsHud` qui ouvre déjà ce menu — on déplace simplement le déclencheur dans la tabbar.

### 5.3 StatsBar

3 cellules horizontalement scrollables (overflow-x:auto si déborde) :
- `<NivGloireCell />` — niveau + gloire actuels, click → modal niveau
- `<CrownsCell />` — Couronnes, click → modal coffre
- `<EnergyIndicator />` — composant existant, click → modal info

Pas de cellule Maison — celle-ci passe en badge sur l'avatar (cf. 5.4).

### 5.4 HouseAvatarBadge

Badge superposé sur l'avatar du `ProfileMenu` :
- Petit cercle ~22×22px en bottom-right de l'avatar
- Affiche l'icône de la Maison/Héritage actuel du joueur (récup via `usePlayerStore` ou nouvelle requête au load)
- Pas cliquable séparément (sinon UX ambigüe avec l'avatar)
- Click sur l'avatar = ouvre `ProfileMenu` qui contient déjà l'entrée "Mon Héritage"

### 5.5 FragmentsCarousel

- Source : `get_recent_fragments(userId, 10)` — fragments triés DESC sur `created_at`
- Layout : horizontal scroll-x, cards 120×140px
- Click sur card → `window.open(fragment.link_url, '_blank')` (vers la collection Shopify reliée)
- Overlay "✓ Possédé" si `owned: true`

### 5.6 PlacesSection

Tabs "Nouveaux" | "Proches" (deux états locaux). Liste verticale de cards lieux.
- Onglet "Nouveaux" : `get_recent_places(10)`
- Onglet "Proches" : `get_nearby_places(userLat, userLng, 10)` — bloquer si pas de geo
- Click sur lieu → navigation vers `/carte?placeId=X` (la carte ouvre la modal du lieu directement)

### 5.7 ActivityFeed

- Source : table `activity_log` filtrée sur types narratifs uniquement
- Types affichés : `place_taken_back_gps`, `place_taken_remote`, `expedition_created`, `place_discovered_first`, `level_up`
- LIMIT 30, ORDER BY created_at DESC
- Format ligne : `[icône type] [acteur] [verbe] [cible] · [il y a X min]`
- Cliquable selon type (lieu → ouvre lieu sur carte, expé → ouvre modal expédition, etc.)

## 6. Direction visuelle

**Direction retenue : V3 parchemin patiné**, mais à *raffiner pixel-perfect au moment de l'implémentation* dans `pnpm dev` (pas dans le visual companion qui rend grossièrement).

Repères :
- **Réutiliser les assets de la LandingPage existante** — PNG parchemin, palette ivoire pastelle exacte (`#eee8dc` fond, `#2a2418` texte sombre, `#c9a96e` accents bronze)
- **Pas trop sombre** — Uriel craint l'oppressant. Pas de fond `#2a2418` plein écran sur la home.
- **Pas trop clair plat** — éviter le rendu "app mobile générique". Garder les textures parchemin et les gradients chauds.
- **Tabbar parcheminée** : gradient ivoire `linear-gradient(180deg, #f4ecd8, #e6dcc4)`, séparateur fin doré `#8a6a3a`, texte uppercase 12px tracking 0.12em, (+) en sceau doré ouvragé
- **Police** : à définir pixel-perfect (la maquette utilisait Georgia par défaut, à valider). Probablement la même que la LandingPage.
- **Image de fond** : envisager un fond Friedrich flouté très atténué derrière la home mobile (comme la LandingPage desktop)

## 7. Travail estimé

| Tâche | Estimation |
|---|---|
| Mig 140 (3 RPCs) + tests | 30-45 min |
| Route `/accueil` + adaptations `App.tsx` + redirect | 15 min |
| `BottomTabbar` + `BottomTabbarPlusMenu` (incluant déplacement du FAB existant) | 1h30 |
| `StatsBar` + `HouseAvatarBadge` | 45 min |
| `DailyEnigmaCard` (wrapper) | 30 min |
| `FragmentsCarousel` | 1h |
| `PlacesSection` (tabs + 2 listes) | 1h30 |
| `ActivityFeed` | 1h |
| Polish visuel V3 (assets parchemin, couleurs, animations) | 1-2h |
| Tests live (mobile, mobile-Safari, edge cases auth/no-geo) | 30-45 min |
| **Total** | **~7-9h** |

Possible en une session intensive si tout va bien. **Si pas fini ce soir, on ne déploie pas.** L'app actuelle suffit pour Echo & Merveilles le 12 mai.

## 8. Hors-scope (V2 ultérieures)

- Sync produits Shopify en base (table `shopify_products`) — pour MVP, les fragments suffisent
- Bandeau "Nouveauté" admin éditable — supprimé du wireframe initial
- Notifications push OS (Web Push API + Service Worker) — déjà différé en mémoire XO
- Vue desktop dédiée de la HomePage — V3 mobile-first uniquement, desktop suit le même layout en colonne centrée max-width
- Personnalisation de la home (réordonner les sections) — pas en V1

## 9. Risques & garde-fous

- **MobileHeader actuel** assume qu'on est sur la carte (le logo reset le mapStore). Adaptation nécessaire pour qu'il fonctionne sur `/accueil` sans casser `/carte`.
- **`get_nearby_places` sans GPS user** : si le user n'a pas autorisé la géoloc, l'onglet "Proches" doit afficher un fallback ("Active la géolocalisation"). Pas planter.
- **Activity_log volumineux** : la table grandit vite. RPC à indexer sur `created_at DESC` + filtre par type. Vérifier les plans d'exécution avant push prod.
- **Le `(+)` de la tabbar duplique le FAB actuel** : à la migration, désactiver l'ancien FAB de `ExpeditionsHud` pour éviter doublon.
- **Pattern SaveBar try/finally** (cf. mémoire XO 8 mai) — appliquer à tous les nouveaux handlers async des nouveaux composants.

## 10. Dépendances

- Branche `home-pivot` créée depuis `main` à jour
- Pas de dépendance sur d'autres chantiers en cours

## 11. Out-of-band

Si la session ne tient pas dans le temps imparti :
- Ne pas merger sur `main`
- Garder la branche locale + push sur la remote pour reprise post-festival
- App actuelle reste en prod inchangée
