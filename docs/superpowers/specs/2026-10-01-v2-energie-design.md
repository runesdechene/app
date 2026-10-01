# L'énergie revient — découvrir loin se mérite

> Conception du 01/10/2026, à la suite du premier retour des testeurs de la V2 : ils regrettent la
> jauge d'énergie. Revient sur la décision du 27/09 (« l'énergie est supprimée ») pour les seuls
> lieux lointains. Maquettes Figma « Énergie — 1 à 4 » (358:164, 358:222, 358:231, 358:241).

## Pourquoi

Découvrir gratuitement autour de soi plaît. Mais sans prix, un lieu à l'autre bout du monde vaut
autant qu'un lieu voisin : il n'y a plus rien à aller chercher. L'énergie rend les lieux lointains
rares, donc désirables.

## La règle

- La distance se mesure entre le lieu et **ta position du moment** (GPS sur téléphone,
  approximative sur ordinateur).
- **Moins de 100 km : gratuit.** 100 à 500 km : **1 point**. 500 à 1 500 km : **2 points**.
  Au-delà : **3 points**.
- **Sans position** (refusée ou indisponible) : 3 points. On ne peut pas prouver que le lieu est
  proche.
- **La jauge : 10 points, +1 par Fragment possédé.** Un point revient par heure, jusqu'au maximum.
  Cette règle remplace tous les bonus d'énergie d'avant (les 5 Fragments à bonus, les bonus de
  Compagnie).
- Visiter sur place reste gratuit. Une découverte déjà faite ne se repaie jamais. L'expérience
  gagnée ne change pas.
- Les seuils et les coûts vivent dans `app_settings`, réglables sans toucher au code :
  `decouverte_gratuite_km` (100), `decouverte_palier_1_km` (500), `decouverte_palier_2_km`
  (1 500), `decouverte_cout_1` (1), `decouverte_cout_2` (2), `decouverte_cout_3` (3),
  `default_max_energy` (passe de 9 à 10), `energy_base_cycle` (3 600 s, inchangé).

## La jauge est partagée avec la V1

V1 et V2 lisent la même colonne `users.energy_points`. Le maximum se calcule à un seul endroit,
`_energie_max(user)` = `default_max_energy` + nombre de Fragments possédés. La fonction de la V1
qui recharge et rend la jauge (`get_user_energy`) l'utilise aussi : les deux apps affichent le même
chiffre et rechargent jusqu'au même plafond.

Ce qui ne change pas en V1 : ses coûts de découverte (1 / 2 / 3 points selon ses propres paliers,
dès le premier kilomètre). La V1 s'arrête à la bascule ; on ne réécrit pas sa règle d'ici là.

## Côté base

- **`_energie_max(p_user text)`** — 10 + 1 par Fragment.
- **`get_user_energy`** (V1, copiée de sa définition live) : son maximum vient de `_energie_max` ;
  les bonus de Compagnie et de Fragments n'y entrent plus.
- **`mon_energie()`** — pour la V2 : `{ points, max, prochainDans }` (secondes avant le prochain
  point, `null` si la jauge est pleine). Recharge comprise : elle s'appuie sur `get_user_energy`.
- **`cout_decouverte(p_id text, p_lat, p_lng)`** — `{ cout, distanceKm }` (`distanceKm` est
  `null` sans position). Le serveur calcule le prix, l'écran l'affiche.
- **`decouvrir_lieu(p_id, p_lat, p_lng)`** (367, copiée de sa définition live) : calcule le coût de
  la même façon, recharge la jauge, refuse si elle ne suffit pas (`ERRCODE` dédié, avec le coût et
  les points restants), sinon retire les points puis découvre comme aujourd'hui.

Le registre de purge reçoit : `users.max_energy`, `factions.bonus_*energy*`,
`title_fragments.bonus_type` (énergie) — lus nulle part après cette migration.

## Les écrans

- **La jauge sur la carte** (358:164) : une gélule sous la recherche, « ⚡ 7 / 10 · +1 dans
  23 min » (sans le compte à rebours quand elle est pleine). La toucher ouvre une feuille courte
  qui dit la règle : gratuit à moins de 100 km, le prix au-delà, 1 point par heure, +1 par
  Fragment.
- **Le voile de découverte** (358:222 / 358:231 / 358:241) : sous « Passe ton doigt… », une gélule
  donne le prix avant le geste — « Gratuit · à 42 km de toi », ou « ⚡ 2 points d'énergie · à
  780 km » avec « Il t'en restera 5 sur 10 ».
- **Pas assez d'énergie** : le sceau pâlit, le geste est désactivé, « Reviens dans 1 h 23 pour le
  révéler », « ⚡ Il te faut 3 points · il t'en reste 1 », puis « Le prochain point revient dans
  23 min. Les lieux à moins de 100 km restent gratuits. »
- Après une découverte payante, la jauge se met à jour sans recharger la page (cache TanStack
  Query invalidé).

## Le Hub : une page « Énergie »

Une page dédiée, pour les administrateurs, qui règle sans toucher au code :

- **le maximum sans Fragment** (`default_max_energy`, 10) — le joueur a ce chiffre + 1 par Fragment ;
- **le temps de reprise d'un point** (`energy_base_cycle`, saisi en minutes, 60) ;
- **les distances et les prix** : la zone gratuite (100 km), les deux paliers (500, 1 500 km) et
  les trois coûts (1, 2, 3).

Elle écrit dans `app_settings` comme le fait déjà la page « Réglages ». Un rappel en tête dit ce
que vit le joueur avec les valeurs saisies (« 10 points + 1 par Fragment, un point toutes les
60 min, gratuit à moins de 100 km… »).

La page « Réglages » perd sa partie énergie : le maximum par joueur (`users.max_energy`, ignoré
désormais) et le temps de recharge (déplacé ici). Ses paliers de distance restent : ce sont ceux
de la V1, jusqu'à la bascule.

## Erreurs et cas limites

- Le serveur a toujours le dernier mot. Si l'écran a affiché un prix et que le serveur refuse
  (la jauge a baissé entre-temps, dans l'autre app par exemple), le voile passe à l'état « pas
  assez d'énergie » avec les chiffres du serveur. Jamais un clic qui ne fait rien.
- La position arrive après l'ouverture du voile : le prix s'affiche « … » puis se met à jour. Si
  elle n'arrive pas, le prix sans position (3 points) s'affiche.
- Le compte à rebours se calcule depuis `prochainDans` et se rafraîchit chaque minute ; à zéro, la
  jauge se relit.

## Tests

- SQL (transaction annulée) : gratuit à 42 km ; 1, 2, 3 points aux paliers ; sans position,
  3 points ; refus quand la jauge est trop basse, sans rien écrire ; jauge à 10 + Fragments ;
  recharge d'un point par heure, plafonnée ; déjà découvert, pas de second paiement.
- Vitest : la lecture de `mon_energie` et `cout_decouverte` ; la gélule (pleine, en recharge) ; le
  voile dans ses trois états ; le refus du serveur qui bascule le voile.

## Hors périmètre

Les Couronnes et les énigmes restent en sommeil. Pas de nouvelle façon de gagner de l'énergie
(quêtes, achats) : la recharge et les Fragments suffisent pour l'instant.
