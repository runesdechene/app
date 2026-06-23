# SPEC — Purification des factions + Renommage en Classes (V1.0)

> Brainstorm Uriel + XO, 23 juin 2026. Branche `v1-refonte-identite`.
> Track ① + ② de SPEC 1 (Les Classes), livrés **ensemble**. Le design d'identité est dans
> `docs/superpowers/specs/2026-06-23-v1-classes-chevaliers-errants-design.md` (identité verrouillée).
> Règle de chantier : **migrations ADDITIVES uniquement** (on neutralise / court-circuite,
> on ne DROP rien). Dette de DROP final → `docs/db/cleanup-v1-identity.md`.

## But

Transformer les 4 factions (camps compétitifs : score Coupe, territoires colorés, bonus
mécaniques) en **classes d'identité purement visuelles**. La faction reste portée par
`users.faction_id` (conservé, base des futures synergies de Compagnie), mais ne pilote plus
**aucune** mécanique de compétition / score / territoire. La compétition reviendra plus tard
au niveau **Compagnie** (SPEC 2).

## Hors scope (tracks suivants)

- Le **QCM** « Quel explorateur es-tu ? » (accueil) et l'**écran révélation** de réveil de la
  base — track événementiel, spec ultérieure. L'écran de choix actuel (`FactionModal`) reste
  l'unique point de choix, simplement renommé et débarrassé de l'équilibrage.
- La refonte **Territoire & scoring** (SPEC 3) et **Compagnies** (SPEC 2).

---

## 1. Mapping faction → classe (verrouillé, vérifié contre la prod)

`users.faction_id` **conservé** ; on ne renomme que les libellés (UPDATE sur `public.factions`).

| `faction_id` (DB, conservé) | Titre actuel | Couleur DB | → Classe | Héritier (lore) |
|---|---|---|---|---|
| `faction-byzantine` | La Chevauchée du Crépuscule | 🟣 `#a93d76` | **L'Archiviste** | moines-copistes |
| `faction-celtique` | Les Pèlerins des Brumes | 🟢 `#57b33d` | **Le Pèlerin** | druides |
| `faction-nordique` | La Garde Boréale | 🔵 `#3c56be` | **Le Rôdeur** | grands navigateurs |
| `faction-romaine` | Les Légions d'Airain | 🔴 `#c94436` | **Le Protecteur** | Hospitaliers |

### Descriptions (écran de choix) — verrouillées

- **🟣 L'Archiviste** · *héritier des moines-copistes* : « L'Archiviste accueille ceux qui refusent que les choses disparaissent. Quand un lieu s'efface, c'est lui qui le retient ; quand une histoire s'éteint, c'est lui qui la rallume. Son combat n'est pas contre les hommes, mais contre l'Oubli lui-même. »
- **🟢 Le Pèlerin** · *héritier des druides* : « Le Pèlerin accueille les âmes contemplatives, ceux qui entendent une présence dans une source, un vieux chêne, une pierre levée — et qui s'inclinent là où d'autres ne voient qu'un décor. Il refuse que le monde oublie qu'il est encore vivant et sacré. »
- **🔵 Le Rôdeur** · *héritier des grands navigateurs* : « Le Rôdeur accueille les cœurs sans repos, ceux que l'horizon appelle et qui s'enfoncent là où les chemins s'effacent, pour débusquer les lieux que le monde a cessé de fouler. Quand une route s'oublie, c'est lui qui la rouvre. »
- **🔴 Le Protecteur** · *héritier des Hospitaliers* : « Le Protecteur accueille les âmes loyales et constantes, ceux qui ne se contentent pas de trouver un lieu mais veillent sur lui, le défendent et le soignent pour qu'il ne retombe pas dans la nuit. Ce qu'il a juré de garder, l'Oubli ne le reprendra pas. »

### Registre UI

- User-facing = **« type d'explorateur »** / **« classe »**. Jamais « Ordre » ni « Chevalier
  Errant » en libellé d'interface — l'épique (Chevalier Errant, héritiers historiques) vit dans
  le **lore et les descriptions**.

---

## 2. Purification — couplages à découpler

### 2.1 Carte → neutre
- **Retirer la couche territoire** (zones/blobs colorés par faction dominante) :
  `lib/map-layers.ts` (`buildTerritoryFillLayer` / `buildTerritoryPatternLayer`),
  `workers/territoryWorker.ts`, usage dans `components/map/core/ExploreMap.tsx`.
- **Marqueurs neutres** : `components/map/markers/OnlinePlayerMarkers.tsx` (`factionColor`),
  `VeilleurNamePills.tsx`, marqueurs de lieux → couleur neutre par défaut (sépia/or, ex `#C19A6B`).
- **Retirer le toggle** `factionColorMode` : `stores/mapStore.ts` + le contrôle UI qui le bascule.

### 2.2 Coupe → table rase
- **Retirer `FactionBar`** entièrement (scoreboard jauges + **bandeau victoire** ajouté le 23/06
  + bouton CoupeModal) de l'UI carte.
- `get_coupe_state`, `_user_coupe_score`, `coupe_seasons` : **conservés en base** (données
  intactes, additif), simplement **plus consommés** par le front. Saison 1 reste figée.
- Note assumée : le bandeau victoire déployé le 23/06 disparaît avec la table rase ; l'email
  récompense reste la trace durable.

### 2.3 Mécénat → individuel
- `components/places/details/PlaceCourtView.tsx`, `PatronsList.tsx`, `CourtTensionBar.tsx`,
  `TerritoryPanel.tsx` : retirer la dimension **faction / tension entre camps**. La Cour =
  **classement des mécènes par points individuels** (top mécène = principal, cohérent avec la
  pilule sous marker). Pas de couleur de classe sur les badges (classe = profil + Dortoir).

### 2.4 Baroud d'Honneur / underdog → supprimé
- `get_underdog_faction_id` plus appelée ; retirer la logique d'équilibrage (underdog + bonus
  régen) du `FactionModal` et des calculs. `factions.bonus_regen*` neutralisés (cf. 2.5).

### 2.5 Bonus de faction → neutralisés
- Colonnes `bonus_*` de `factions` + table `faction_tag_bonuses` : **cesser de les appliquer**
  partout (énergie, conquête, construction, régen, réduction de coût par tag). Identité pure,
  zéro bonus. Mise à zéro / court-circuit dans les RPC concernées (`set_user_faction`,
  calculs d'énergie, `get_faction_tag_reduction`). Additif : on ne DROP pas les colonnes.

### 2.6 Noms de territoires → parqués
- `propose_territory_name` / `vote_territory_name` / `get_winning_territory_names` +
  `territory_name_proposals` / `territory_name_votes` : **masqués/gelés** côté front (et RPC
  qui refusent poliment), **données conservées**. Reviennent au SPEC 3.

---

## 3. Conservé

- **Dortoir** : chat de faction → chat de classe. `chat_messages` (canal `faction`),
  `ChatPanel.tsx`, `useChat.ts`, `chatStore.ts` inchangés ; seul le libellé/couleur suit le
  renommage. C'est le lieu qui réunit les joueurs d'un même style.
- `users.faction_id` + `users.faction_changed_at` : porteurs de la classe.
- `set_user_faction` : conservée comme **changement de classe** (libre, message de confirmation
  qui pèse), **débarrassée** des effets de bord score/bonus/underdog. `get_factions_for_choice`
  conservée mais **sans le tri d'équilibrage** (ordre stable).
- `FactionModal` : reste l'écran de choix, **renommé** (« Choisis ton type d'explorateur »),
  descriptions de classe, sans bonus ni Baroud d'Honneur.

---

## 4. Renommage (track ②, livré avec)

- **DB** : `UPDATE public.factions SET title, description, adjective, image_url` par `id`
  (additif, par `id`) selon §1. Emblèmes/bannières de classe à fournir (assets ChatGPT en cours).
- **Libellés UI** : `FactionModal` (+ `.css`), `FactionBar` (retiré donc N/A), `ProfileMenu`
  (« Rejoindre une faction » → « Choisir ta classe »), `OnboardingModal`, `FactionMembersModal`,
  affichage profil (`PlayerProfileModal`, `types/playerProfile.ts`). « Faction/Maison » →
  « type d'explorateur / classe ».
- Titres de faction (`titles.faction_id`, `get_user_titles`) : libellés à revoir si « faction »
  apparaît user-facing.

---

## 5. Méthode & risques

- **Migrations additives** : neutralisation par court-circuit/valeurs par défaut, jamais de DROP.
  Chaque retrait définitif (colonnes bonus, place_influence, claimed_*, territory_name_*) →
  noté dans `docs/db/cleanup-v1-identity.md` pour le grand DROP final (fin de campagne).
- **L'ancien monde tourne sous les users** pendant le build (front masque, back additif).
- **Release coordonnée** purification + renommage (validé) : on n'expose pas une carte grise
  avec des « Maisons » ; le renommage donne le sens (« ta Maison devient ta classe »).
- Risque front : `FactionBar` / `map-layers` / `territoryWorker` sont touchés par d'autres
  vues — vérifier qu'aucun écran ne crashe sur l'absence de `factionColorMode` / couche
  territoire. **Test local obligatoire (pnpm dev + click flow) avant deploy.**

## Liens
- Identité : `2026-06-23-v1-classes-chevaliers-errants-design.md`
- Socle vault : `🌳 SPEC — Le Mouvement, les Compagnies & les Classes`
- Dette : `docs/db/cleanup-v1-identity.md`
