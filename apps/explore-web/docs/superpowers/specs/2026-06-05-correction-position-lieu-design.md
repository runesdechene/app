# Correction de la position d'un lieu — Design

> Date : 2026-06-05
> App : explore-web (+ migration Supabase)
> Statut : validé (design), prêt pour plan d'implémentation

## Contexte & problème

Des joueurs signalent ne pas pouvoir corriger la position géographique d'un lieu
mal placé (pin tombé à côté lors de la création à distance, coordonnées
approximatives, etc.). Aujourd'hui la position (`places.latitude/longitude`) est
figée après la création via `create_place` ; seuls la description, l'époque et
quelques infos communautaires sont éditables a posteriori.

On veut permettre la correction de la position **aux personnes légitimes** :
l'auteur du lieu, ou tout joueur qui s'est rendu sur place au moins une fois.

## Décisions structurantes (validées avec Uriel)

| Décision | Choix retenu |
|----------|--------------|
| Éligibilité | Auteur du lieu **OU** visiteur (présent dans `place_explorers`) |
| Modèle de confiance | **Édition immédiate**, sans plafond de distance |
| Historique | **Trace en lecture seule** — pas de bouton « restaurer » dédié |
| Notifications | Auteur **+ veilleur actuel** du lieu |
| Adresse | **Couplée** : re-géocodage proposé + champ adresse éditable |
| Points / récompenses | Aucun (corriger n'est pas une action récompensée) |

Rationale du modèle « immédiat sans limite + trace » : c'est le plus fluide pour
le joueur de bonne foi (la grande majorité). L'anti-abus passe par la
**transparence** (trace persistée + notification aux parties prenantes) plutôt
que par un mur de validation. À durcir seulement si un abus est constaté.

## Comportement (règles métier)

- **Éligibilité vérifiée côté serveur** dans la RPC (`SECURITY DEFINER`). La
  condition front ne sert qu'à afficher/masquer le bouton ; elle n'est pas
  l'autorité.
- L'édition met à jour `latitude`, `longitude`, `address`, `updated_at` du lieu,
  immédiatement et pour tous les joueurs.
- **Garde-fou fiabilité** : un `window.confirm` avant envoi
  (« Confirmez-vous que cette position est exacte ? Elle remplace l'actuelle
  pour tous les joueurs. »), cohérent avec les contributions Infos existantes
  (`PlaceInfos.tsx`).
- **Aucun point** attribué, ni en DB ni en UI (cohérent avec les contributions
  epoch / accessibilité / saison / warning — décision Uriel 2026-05-03).

## UI — point d'entrée + éditeur

### Point d'entrée

Nouvel item **« ✏️ Corriger la position »** ajouté au **menu déroulant existant**
près de l'adresse (`place-options-menu` dans
`apps/explore-web/src/components/places/views/PlacePanel.tsx`, ~ligne 710),
à la suite de : 🗺️ Voir sur la carte · 📍 Google Maps · 🚗 Waze.

- Rendu **conditionnel à l'éligibilité** (auteur ou visiteur).
- Zéro nouvelle surface visible — l'item s'intègre au menu déjà déclenché par
  l'icône « carte » près de l'adresse.

### Éligibilité côté front

La fiche doit savoir si l'utilisateur courant est éligible. Approche :
exposer un booléen `can_edit_position` (ou les deux signaux `is_author` +
`has_visited`) dans le payload de détail du lieu (RPC `get_place_detail`, à
étendre), calculé serveur. Le store `playerStore` connaît déjà `userId` et
`discoveredIds` ; `place_explorers` est l'autorité pour « a visité ».
> À confirmer au moment du plan : forme exacte (flag dédié vs deux booléens) et
> point d'injection dans `get_place_detail`.

### Éditeur — `EditPositionFlow`

Nouveau composant qui **réutilise le pattern viseur plein écran d'`AddPlaceFlow`**
(crosshair central, inputs Lat/Lng, bouton « 📍 Ma position », boutons zoom),
**pré-centré sur la position actuelle du lieu**. Étapes :

1. **Position** — déplacer la carte sous le viseur ou saisir lat/lng → « Valider ».
2. **Adresse** — reverse-geocoding Nominatim (comme à la création) propose la
   nouvelle adresse dans un champ **éditable** ; l'utilisateur peut l'ajuster.
3. **Confirmation** — récap « ancienne → nouvelle position » + `window.confirm`,
   puis appel RPC.

À l'arrivée (succès) : `useMapStore.incrementPlacesRefreshKey()` +
`requestFlyTo` sur le nouveau point ; le marqueur se déplace ; la fiche se
rafraîchit (`onRefresh`).

### Refactor ciblé

Factoriser le viseur plein écran (crosshair + barre coords + bouton GPS + zoom)
d'`AddPlaceFlow` en sous-composant partagé sous
`apps/explore-web/src/components/places/shared/` (ex. `MapCrosshairPicker`),
consommé par `AddPlaceFlow` **et** `EditPositionFlow`. Évite la duplication de
~150 lignes. Dans l'esprit du sprint Purification (sous-composants partagés).

## Serveur — RPC + table

### RPC `update_place_position` (`SECURITY DEFINER`)

Signature :

```
update_place_position(
  p_user_id    text,
  p_place_id   text,
  p_latitude   real,
  p_longitude  real,
  p_address    text
) RETURNS json
```

Logique :

1. Charger `author_id`, `latitude`, `longitude`, `address` du lieu (sinon
   `{error: 'not_found'}`).
2. **Vérifier l'éligibilité** : `author_id = p_user_id`
   **OU** `EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_place_id
   AND user_id = p_user_id)`. Sinon `{error: 'not_eligible'}`.
3. Insérer l'ancienne position dans `place_position_history`.
4. `UPDATE places SET latitude = p_latitude, longitude = p_longitude,
   address = p_address, updated_at = NOW() WHERE id = p_place_id`.
5. Notifier l'auteur + le veilleur (cf. section Notifications), en excluant
   l'éditeur lui-même.
6. Logger dans `activity_log`.
7. Retourner `{success: true, latitude, longitude, address}`.

> Note de cohérence avec l'existant : `create_place` reçoit lat/lng en numérique
> et la colonne est `real`. La RPC accepte `real` ; le front envoie des nombres.

### Table `place_position_history`

Nouvelle migration numérotée (prochaine dispo : **214+** ; la dernière est
`213_fix_glory_photos_count.sql`).

```
place_position_history (
  id              uuid     PK  DEFAULT gen_random_uuid(),
  place_id        varchar  NOT NULL  REFERENCES places(id),
  user_id         varchar  NOT NULL  REFERENCES users(id),
  old_latitude    real     NOT NULL,
  old_longitude   real     NOT NULL,
  new_latitude    real     NOT NULL,
  new_longitude   real     NOT NULL,
  old_address     text,
  new_address     text,
  created_at      timestamptz NOT NULL DEFAULT NOW()
)
```

- **RLS** : lecture autorisée (au minimum auteur / veilleur / admin ; à préciser
  au plan). Écriture uniquement via la RPC `SECURITY DEFINER`.
- **Trace en lecture seule** — aucune RPC de « restauration ». Corriger une
  mauvaise correction = refaire une édition normale (tout éligible peut déjà
  re-déplacer le pin librement).

## Notifications & transparence

- **Nouveau type de notification `place_position_edited`** envoyé à :
  - l'**auteur** du lieu (`places.author_id`),
  - le **veilleur actuel** (`get_place_guardian(p_place_id)`),
  - en **excluant l'éditeur** s'il est l'un des deux.
  - Payload : nom de l'éditeur, titre du lieu, distance du déplacement
    (`haversine_km` entre ancien et nouveau point).
- **`activity_log`** : une entrée pour la trace globale.
- **Inline sur la fiche** : « Position modifiée par {nom} · il y a {X} »
  (réutilise le pattern `info-meta` de `PlaceInfos.tsx`). Données issues de la
  dernière ligne de `place_position_history` (exposées via `get_place_detail`).

## Effets de bord (assumés, pas d'action spéciale)

- `place_explorers` **conservé** : les visites passées restent valides.
- Fog of war, territoires / Empires, La Cour, veille : se recalculent
  naturellement à partir des nouvelles coordonnées.
- `slug` et `seo_description` inchangés (la position ne les dérive pas).
- Éligibilité à la visite GPS future : mesurée contre les **nouvelles**
  coordonnées (comportement attendu).

## Hors-scope V1 (YAGNI)

- Pas de modale « Historique des positions » complète — on **stocke** la trace ;
  affichage riche reporté si besoin réel.
- Pas de bouton « restaurer » / revert.
- Pas de modération / validation préalable.
- Pas de plafond de distance, pas de rate-limit.
  → à durcir uniquement si un abus est constaté.

## Fichiers impactés (prévisionnel)

- **Migration** `supabase/migrations/214_*.sql` (ou 214 table + 215 RPC) :
  table `place_position_history`, RPC `update_place_position`, RLS, éventuel
  ajout au payload `get_place_detail` (flags éligibilité + dernière édition).
- **Front** :
  - `components/places/views/PlacePanel.tsx` — item de menu conditionnel.
  - `components/places/modals/EditPositionFlow.tsx` (nouveau).
  - `components/places/shared/MapCrosshairPicker.tsx` (nouveau, factorisé d'`AddPlaceFlow`).
  - `components/places/modals/AddPlaceFlow.tsx` — consomme le picker partagé.
  - `types/placeDetail.ts` — flags éligibilité + métadonnées dernière édition.

## Critères d'acceptation

1. Un **non-éligible** (jamais visité, pas auteur) ne voit pas l'item de menu, et
   un appel direct à la RPC renvoie `not_eligible`.
2. Un **visiteur** corrige la position : le marqueur bouge pour tous, l'adresse
   est mise à jour, `updated_at` rafraîchi.
3. Une **ligne d'historique** est créée à chaque correction (ancien + nouveau).
4. L'**auteur** et le **veilleur** reçoivent une notification `place_position_edited`
   (sauf s'ils sont l'éditeur).
5. La fiche affiche « Position modifiée par {nom} · il y a {X} ».
6. `pnpm build` passe (TS strict, pas de `any`, pas de `console.log`).
