# Recherche & Filtres — Design

> Statut : **validé en brainstorm** (2026-06-04) · App : `explore-web` · Auteur : Uriel + XO
> La dernière grande fonction de findabilité de l'appli : trouver vite, et sculpter la carte.

---

## 1. Problème & objectif

L'appli compte **2814 lieux publics** mais aucune vraie recherche ni aucun filtre. Aujourd'hui on
zoome/scroll à la main. Le besoin n°1 exprimé : **trouver vite une cible précise**. Le besoin n°2 :
**filtrer la carte** (et les listes) selon l'intention du moment, avec des filtres **combinables**.

**Objectif** : une barre de recherche qui téléporte vers une cible + un panneau de filtres combinables,
sur la carte d'abord, réutilisables sur les listes.

### Non-objectifs (YAGNI)
- Pas de recherche de factions (écarté par Uriel).
- Pas de révélation de position de joueur via la recherche (vie privée).
- Pas de recherche serveur lourde pour les lieux : tout est déjà en mémoire.
- Pas de filtre « énigme active » (ce concept par-lieu n'existe pas).

---

## 2. Forme générale (décision : **option B**)

Deux intentions distinctes, jamais empilées :

- **Une barre flottante** sous le header (façon Google Maps) → *trouver une chose*.
- **Un bouton entonnoir** à droite de la barre → *sculpter la carte*. Pastille = nb de filtres actifs.

Pas de 6ᵉ onglet (la barre du bas est pleine : Carte · Activité · Messages · Quêtes · Profil).

```
┌───────────────────────────────┐
│ 🌳 Runes              🛒  ☰    │  ← MobileHeader existant
├───────────────────────────────┤
│ [🔍 Rechercher un lieu, une… ] [⚙︎²] │  ← barre flottante + entonnoir (badge)
│                                       │
│            ( carte )                  │
└───────────────────────────────┘
```

---

## 3. Pilier RECHERCHE

Tap sur la barre → **overlay plein écran**, input focus, résultats **groupés par catégorie**.
État vide = recherches récentes (localStorage).

| Domaine | Source | Comportement au choix |
|---|---|---|
| **Lieux** | **Client-side**, fuzzy sur `title` + `address` (déjà en mémoire via `usePlaces`) | Centre la carte + ouvre la fiche du lieu |
| **Villes / coins** | **Nominatim forward** (réutilise le pattern reverse de `AddPlaceFlow`) | « Voler ici » : `flyTo` sur le bbox/centre retourné |
| **Joueurs** | **Nouvelle RPC `search_players`** | Ouvre la **fiche publique seule** (`PlayerProfileModal`) — **jamais la position** |

Ordre d'affichage : **Lieux** (instantané) → **Villes** → **Explorateurs**.

### Contraintes
- **Nominatim** : politique d'usage (≈1 req/s, User-Agent/Referer propre). → recherche ville **débouncée**
  (~400 ms) et/ou déclenchée à la frappe ralentie, jamais à chaque caractère. Attribution OSM si requise.
- **Lieux** : matching accent-insensible + sous-chaîne. ~2814 items → trivial en mémoire, pas de worker.
- **`search_players`** : `SECURITY DEFINER`, retourne `{ id, userName, avatarUrl, factionId, factionTitle, factionColor, level }` — **aucune coordonnée**. Limite ~10 résultats, match sur `userName`.

---

## 4. Pilier FILTRES

**Bottom-sheet** monté par-dessus la carte (bouton entonnoir). Filtres **combinables** :
- **OU dans une même famille** (ex. tag Mégalithes OU Sources)
- **ET entre familles** (ex. (Mégalithes OU Sources) ET époque Âge du Fer ET à explorer)

**Filtrage en direct** : la carte se met à jour pendant qu'on coche, le compteur recalcule
(« Voir les 214 lieux »). Pas de bouton « Appliquer » obligatoire — le CTA referme la feuille.
Bouton **Réinitialiser**.

### Familles (ordre du panneau)

1. **🏷️ Tags** (21, toujours visibles) — pastilles aux **vraies couleurs de marque** (`tags.color` /
   `tags.background`) + icône SVG (`tags.icon`). 99,9 % des lieux taggés. Match sur **tous** les tags
   d'un lieu (primaire + secondaires), pas seulement le primaire.
2. **🔥 Événements** (toujours visible) — **toggle de couche** : afficher/masquer les **médaillons
   d'expéditions actives** (déjà chargés via `list_voyages_for_map` → `mapBanners`).
   ⚠️ *N'est pas un filtre d'attribut de lieu* (les expéditions sont à des points GPS libres).
   → **Hypothèse à confirmer en relecture.**
3. **✨ Ma progression** (toujours visible) — tri-état **exclusif** : `Tout` / `À explorer (non
   découverts)` / `Déjà découverts`. Source : `discoveredByMe` (cf. §5).
4. **⏳ Époque** (12, toujours visible, **placée en bas**) — pastilles multi-sélection. C'est la facette
   « statique » riche (toutes les 12 époques peuplées). Affine le résultat.
5. **⚔️ Factions & territoire** (**visible UNIQUEMENT si `playerStore.factionColorMode === true`**) :
   - *Quelle Maison contrôle* : les 4 Maisons (pastille couleur faction) + **⚪ Libre / sans veilleur**.
     Source : **store veille** (déjà chargé, client-side).
   - *État du lieu* : **⚔️ En siège** et **⏳ Bascule imminente (critique)** — deux toggles distincts,
     calqués sur `SiegeStatus = 'siege' | 'critical'` (`siegeStore.statusByPlaceId`, client-side).

### Réutilisation sur les listes
Le même état de filtres s'applique aux listes (home « lieux récents / proches », futures listes) —
« sur l'appli en général ». → l'état de filtres vit dans un **store partagé**, pas local à la carte.

---

## 5. Données & architecture

Tout le filtrage et la recherche de lieux sont **100 % client-side** (les lieux sont déjà en mémoire).
Seuls manquent quelques champs dans le payload.

### 5.1 Extension de `get_map_places` (migration)
Le payload actuel ne renvoie que le **tag primaire**, pas l'époque. Ajouter :
- `eraId` (`places.era_id`)
- `tagIds` : **tableau de tous** les `tag_id` du lieu (pas seulement `is_primary`)
- `address` (`places.address`) — pour la recherche/sous-titre

Aucun nouveau round-trip : ces colonnes/JOIN sont déjà presque tous présents.
**`discoveredByMe` n'est PAS nécessaire** : l'état découverte est déjà client-side via
`usePlayerStore.discoveredIds` (enrichi dans `usePlaces` → `PlaceProperties.discovered`).

### 5.2 Nouvelle RPC `search_players(p_query text)`
`SECURITY DEFINER`, `ILIKE` accent-insensible sur `userName`, **sans coordonnées**, limite 10.

### 5.3 Sources client-side réutilisées (aucune nouvelle requête)
| Filtre | Store / source |
|---|---|
| Faction qui contrôle | store **veille** (`ensureFactionsCache` / `loadInitialVeilles`) |
| En siège / critique | **`siegeStore.statusByPlaceId`** |
| Mode faction (gating) | **`playerStore.factionColorMode`** |
| Découvert par moi | **`playerStore.discoveredIds`** (déjà chargé) |
| Événements (couche) | **`expeditionsStore.mapBanners`** |
| Lieux (recherche + filtres) | **`usePlaces`** (payload étendu) |

### 5.4 Lib
- `lib/geocode.ts` — wrapper Nominatim **forward** (debounce, headers, parsing, garde-fous d'erreur).
- `lib/placeSearch.ts` — normalisation accents + match sous-chaîne sur titre/adresse.

---

## 6. Composants & fichiers (suivre la structure `components/map/`)

```
components/map/
├─ search/
│  ├─ SearchBar.tsx        barre flottante + bouton entonnoir (badge)
│  ├─ SearchOverlay.tsx    plein écran, input, résultats groupés, récents
│  └─ results/             PlaceResult · CityResult · PlayerResult (lignes)
├─ filters/
│  ├─ FilterSheet.tsx      bottom-sheet, CTA compteur live, reset
│  └─ families/            TagsFilter · EventsToggle · ProgressFilter ·
│                          EraFilter · FactionTerritoryFilter (gated)
stores/
└─ searchFilterStore.ts    état filtres + recherche + sélecteur dérivé (set filtré + count)
lib/
├─ geocode.ts
└─ placeSearch.ts
supabase/migrations/
└─ NNN_search_players_and_map_places_facets.sql
```

Intégration carte : `MapMarkers` lit le **set filtré** depuis `searchFilterStore` (prédicat appliqué
sur les lieux en mémoire). La couche **bannières d'événements** écoute le toggle Événements.

---

## 7. Gestion d'état (`searchFilterStore`)

```ts
interface SearchFilterState {
  // Filtres actifs (familles)
  tagIds: Set<string>
  eraIds: Set<string>
  progress: 'all' | 'undiscovered' | 'discovered'
  showEvents: boolean
  // Gated (mode faction)
  controllingFactionIds: Set<string>   // + sentinelle 'free'
  siegeStatuses: Set<'siege' | 'critical'>
  // Dérivés
  activeFilterCount: number             // pour la pastille
  // Sélecteur : (places) => places filtrés ; + count live
}
```
- Le **gating** mode faction est appliqué au rendu **et** au prédicat (un filtre faction inactif
  quand le mode est OFF ne doit pas filtrer silencieusement).
- Réinitialiser = vider tous les sets / remettre `progress='all'`, `showEvents=false`.

---

## 8. Cas limites & erreurs
- **Nominatim indisponible / lent** : timeout court, message discret « zone introuvable », ne bloque
  jamais les résultats Lieux (qui sont locaux et instantanés).
- **0 résultat de filtre** : compteur « 0 lieu », carte vidée des marqueurs lieux, CTA reste « Réinitialiser ».
- **Mode faction basculé pendant que des filtres faction sont actifs** : quand on passe OFF, les filtres
  de la famille gated sont **neutralisés** (pas effacés — réactivés si on rebascule ON dans la session).
- **Accents / casse** : normalisation NFD systématique (lieux ET joueurs).
- **Lieu sans tag / sans époque** (rares) : exclu si un filtre tag/époque est actif, inclus sinon.
- **Calques liés aux lieux** (décision Uriel, 2026-06-05) : le filtre s'applique non seulement aux
  marqueurs (`Source` places) mais aussi à **VeilleurNamePills** ET **HarvestableChests** — un lieu
  masqué ne montre ni icône, ni pilule de veilleur, ni coffre Couronnes (cohérence visuelle totale).
  La `Minimap` reste sur le jeu complet (aide à la navigation).

---

## 9. Tests
- `placeSearch` : accents, sous-chaîne, titre vs adresse, vide.
- `searchFilterStore` : OU intra-famille, ET inter-familles, count, gating faction, reset.
- `geocode` : parsing réponse Nominatim, debounce, timeout/erreur.
- Manuel : overlay (3 groupes), feuille filtres OFF/ON mode faction, filtrage live, listes partagées.

---

## 10. Phasage proposé
1. **Socle** : extension `get_map_places` + `searchFilterStore` + `SearchBar`/overlay + recherche **Lieux**
   + filtres **Tags / Ma progression / Époque** (+ filtrage live + compteur).
2. **Territoire** : famille gated **Factions & territoire** (veille + siège).
3. **Élargissement recherche** : **Villes** (Nominatim) + **Joueurs** (`search_players`).
4. **Événements** : toggle de couche (après confirmation de la sémantique).
5. **Listes** : brancher le store de filtres sur la home.

---

## 11. Hypothèse confirmée (Uriel, 2026-06-04)
- **Filtre « Événements »** = toggle d'affichage des **bannières d'expéditions actives** (couche),
  pas un filtre d'attribut de lieu. ✅ **Confirmé.**
