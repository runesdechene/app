# Les énigmes sur la carte — conception

> 07/10/2026 · V2 (`apps/web-v2`) et Hub (`apps/hub`) · maquettes Figma « Énigmes — 1 à 6 » (fichier App v2,
> page 1, x ≈ 43 400 ; nœuds 459:344, 459:530, 459:672, 460:380, 460:467, 458:540) · décisions dans le
> `_État.md` d'Explore (Tranché, 07/10) · idée d'origine : note du vault « Jouer sur la carte — énigmes, duels,
> Seigneuries » (06/10)

## Pourquoi

Les joueurs demandent « de quoi jouer sur la carte » et le retour des énigmes. La V2 en a besoin **pour son
lancement** : elles sont construites avant la bascule. Elles font revenir (on les résout à distance), elles
font apprendre, et elles donnent de la gloire sans classement : des **titres d'expert d'une culture**.

Cette spec remplace, pour les énigmes, la ligne « Couronnes et énigmes en sommeil » de la conception V2
(`2026-08-18-app-v2-design.md`, Points ouverts) : les Couronnes restent en sommeil, les énigmes reviennent.

## Le jeu

- **Des cultures** : Mythologie nordique, Mondes celtes, Rome antique, Grèce antique, Byzance au lancement
  (les cinq thèmes de la V1, `enigma_themes`, ~450 énigmes). Chacune a une **zone** sur la carte : autant de
  cercles qu'on veut, tracés dans le Hub (5 km à 1 000 km), mer comprise — chacun tiré à égalité, un
  petit cercle vaut un site précis (Uriel, 07/10, migration 444). Les zones **se chevauchent exprès** (l'Égée est grecque et
  byzantine).
- **Le réveil** : chaque matin, chaque culture éveille **une énigme**, posée à un point tiré **au hasard dans
  sa zone**. Les positions sont **les mêmes pour tous**. Au plus **7 énigmes éveillées par culture** : au-delà,
  la plus ancienne s'efface.
- **Sur la carte** :
  - dézoomé, chaque énigme est **un éclat** (petit point rouge, halo), à sa place, **sans regroupement** ni
    chiffre (règle de la carte, 27/09) ;
  - à partir de l'échelle d'un pays, l'éclat devient **un sceau de cire « ? »**, le seul qui se touche. Tous
    les sceaux sont pareils : on ne sait pas quelle culture il cache.
- **Le toucher** : le sceau **se retourne** (animation, bruitage) et révèle **l'icône de la culture** ; la
  feuille de l'énigme monte : le récit, la question, les réponses.
- **Une seule réponse** par énigme éveillée. Juste : **+1 XP** et des **points de connaissance** dans la
  culture. Fausse : l'explication, sans points. Dans les deux cas, « Le savais-tu ? » s'affiche.
- **Rien n'est punitif** : une énigme ratée, ou effacée avant d'être vue, **revient longtemps après** (au tour
  suivant de sa culture, voir « Le réveil »). Une énigme percée ne revient jamais pour celui qui l'a percée.
- **Les énigmes réussies dans la V1 comptent** dans les points de connaissance (la mig 433 a effacé les titres
  d'énigmes de l'ancien jeu ; ces points les rendent).
- **Pas de notification** au réveil pour l'instant (à revoir avec les notifications), pas de bandeau à
  l'Accueil (seulement si c'est demandé, écran 6 de la maquette).

## Les points et les titres

**Points de connaissance d'une culture** = la somme, sur les énigmes **distinctes** de la culture percées au
moins une fois (V1 ou V2), du barème de la V1 (`_enigma_score_weighted`, mig 038) :

| Difficulté | Points |
| --- | --- |
| `very_easy`, `easy` | 1 |
| `medium` | 2 |
| `hard` | 3 |

**Le total d'une culture** = la même somme sur toutes ses énigmes **actives** du jeu (voir « Le stock »).
Aujourd'hui ≈ 130 par culture, ≈ 200 pour la Grèce.

**Sept titres par culture.** Seuil = **le plus grand** du plancher et du pourcentage du total :

| Palier | Masculin | Féminin | Plancher | % du total |
| --- | --- | --- | --- | --- |
| 1 | Curieux | Curieuse | 1 | — |
| 2 | Apprenti | Apprentie | 4 | 3 % |
| 3 | Lettré | Lettrée | 10 | 8 % |
| 4 | Initié | Initiée | 20 | 15 % |
| 5 | Érudit | Érudite | 40 | 30 % |
| 6 | Sage | Sage | 70 | 55 % |
| 7 | Maître | Maître | 100 | 80 % |

- Le nom porté = palier + **complément de la culture** réglé dans le Hub : « Sage des arcanes
  scandinaves », « Lettrée de Byzance ». Accordé selon `users.title_gender` (« Tes titres s'accordent au »).
- **Un titre obtenu est acquis** : si le Hub ajoute des énigmes et que le seuil monte, on garde son titre. La
  jauge le dit : « Tu connais 62 % de ce que la Confrérie sait de Byzance. »
- Le plancher empêche un Maître en trois jours sur une petite culture ; le pourcentage rend une grande
  culture plus exigeante.
- **Polymathe** (Polymathe au féminin) : être **Sage dans trois cultures**. Acquis lui aussi.

## Le stock

Une énigme fait partie du jeu des cultures si elle est **active**, a un **`theme`** dont la culture est active,
et **n'est pas une énigme de Fragment** (`fragment_id IS NULL`). Format QCM ou libre (la V1 a les deux).
Les énigmes sont **celles de la V1, à relire** dans le Hub avant le lancement (contenu, pas code).

## La base

Migrations au premier numéro libre au moment de les écrire (pull d'abord : une autre session numérote aussi).
Tout `CREATE OR REPLACE` part de la définition live.

1. **`enigma_themes`** gagne :
   - `complement text` — le complément de titre (« des arcanes scandinaves ») ;
   - `cercles jsonb` — `[{"lat":…, "lng":…, "rayon_km":…}]`, un à trois cercles ;
   - `icon` et `color` existent déjà : `icon` devient l'URL de l'image envoyée par le Hub (storage).
2. **`enigmes_eveillees`** : `id`, `enigma_id` (FK `enigmas`), `theme`, `lat`, `lng`, `eveillee_le`,
   `effacee_le` (null tant qu'elle attend). RLS activée **sans policy** pour `anon` et
   `authenticated` : on n'y lit qu'à travers les RPC ci-dessous (la culture ne doit pas fuiter avant le
   toucher). Le Hub la lit en `service_role`.
3. **`enigma_responses`** gagne `eveil_id` (FK `enigmes_eveillees`, null pour les réponses V1). Contrainte :
   une réponse par compte et par éveil.
4. **Le réveil** — fonction `_eveiller_enigmes()`, planifiée par **pg_cron** chaque matin (comme les tâches
   des migs 144-146 : `cron.unschedule … WHERE EXISTS` avant `cron.schedule`). Pour chaque culture active
   ayant des cercles :
   - choisit l'énigme du stock **réveillée le moins récemment** (jamais réveillée d'abord) : la réserve
     tourne en cycle, et une énigme revient d'elle-même après un tour complet (~75 jours à une par jour) ;
   - tire un point au hasard : un cercle au hasard (pondéré par sa surface), puis un point uniforme dans le
     cercle ;
   - insère l'éveil, puis efface (`effacee_le = now()`) les plus anciens au-delà de 7.
   Heure : 7 h à Paris l'été (cron en UTC, `0 5 * * *` ; 6 h l'hiver, accepté).
5. **`enigmes_en_attente()`** — pour le compte connecté : les éveils non effacés, sans réponse de ce compte à
   cet éveil, dont l'énigme n'a jamais été percée par ce compte. Renvoie **`id`, `lat`, `lng` seulement**.
6. **`ouvrir_enigme(p_eveil)`** — vérifie que l'éveil attend ce compte ; renvoie la culture (nom, icône,
   couleur), le récit, la question, le format, les choix. **Jamais la réponse.**
7. **`percer_enigme(p_eveil, p_reponse)`** — `SECURITY DEFINER`, compte = `auth.uid()` :
   - refuse un éveil effacé, déjà répondu, ou une énigme déjà percée ;
   - compare : QCM à l'égalité, libre avec `_enigma_answer_matches` (mig 003) ;
   - insère dans `enigma_responses` (`correct`, `eveil_id`) ; **ne touche pas aux Couronnes** (contrairement
     à `_answer_enigma_internal`) ;
   - si juste : enregistre les titres de connaissance nouvellement atteints (et Polymathe) ;
   - renvoie : `correct`, la bonne réponse, l'explication, l'XP gagnée (lue avant / après comme
     `decouvrir_lieu`, mig 367), les points gagnés, les points et le total de la culture, le titre obtenu et
     le prochain palier.
8. **L'XP** : `_trg_xp_enigma_insert` (mig 042, toujours branché sur `enigma_responses`) passe à **1 XP
   fixe** pour une réponse juste. La V1 en ligne donnera aussi 1 XP à son énigme du jour : rien ne casse
   chez elle.
9. **Les titres de connaissance** — ils ne se calculent pas à la volée (le seuil bouge, le titre reste) :
   - `titres_connaissance(user_id, theme, palier, obtenu_le)`, PK `(user_id, theme, palier)` ; Polymathe en
     `theme = null`, `palier = 0` ;
   - dans `titles`, une ligne par (culture, palier) et une pour Polymathe, avec
     `condition = {"stat":"connaissance","theme":…,"palier":…}`, pour qu'on puisse les **porter**
     (`users.displayed_title_ids_v3`) ; créées pour les cinq cultures par la migration, et par un trigger sur
     `enigma_themes` à la création d'une culture ;
   - le nom se compose à la lecture : palier (m/f) + `complement` ;
   - **rattrapage V1** : la migration calcule les points de chaque compte depuis `enigma_responses` et insère
     les paliers déjà atteints (`obtenu_le` = date de la migration).
10. **`get_mes_titres`** (mig 433) gagne une famille par culture active : compteur = points, total, titre
    obtenu le plus haut, prochain palier et son seuil ; plus Polymathe. Les chemins existants ne changent
    pas. `get_user_titles` / l'affichage des titres portés reconnaissent `stat = connaissance`.

## L'appli (`apps/web-v2`)

- **Feature `features/enigmes/`** : `api/` (les trois RPC), `lib/` (calques, images des sceaux, son,
  sans état React), `hooks/useEnigmesSurLaCarte.ts`, `components/` (feuille, animation).
- **Carte** : une source GeoJSON `enigmes` (sans `cluster`), deux calques dessinés au canvas comme
  `carte/lib/sceaux.ts` :
  - `eclats` jusqu'au zoom ~6 (réglé à l'œil sur la maquette) ;
  - `sceaux-enigmes` à partir de ~6, seul calque cliquable.
  Rechargée à l'ouverture de la carte et après chaque réponse (le sceau percé disparaît).
- **Le toucher** : un élément posé sur le point touché joue le retournement en CSS (`rotateY`, ~0,3 s), puis
  la feuille monte. `prefers-reduced-motion` : pas de rotation, la feuille monte directement. **Bruitage**
  synthétisé en Web Audio, comme `features/lieu/lib/tintement.ts` (un claquement de cire, commun) ; les sons
  propres à chaque culture viendront plus tard (fichiers).
- **La feuille** : `shared/ui/Feuille.tsx`. En tête l'icône et le nom de la culture ; le récit (IM Fell),
  la question, quatre boutons (QCM) ou un champ (libre). Après la réponse : la bonne en vert (la fausse
  marquée), les gains (« +1 XP », « +2 connaissance · Byzance »), « Le savais-tu ? », la jauge vers le
  prochain titre, et le pied (« Trois autres « ? » attendent autour de l'Égée… »). Un nouveau titre se dit
  dans la feuille (« Te voilà Lettrée de Byzance »).
- **« Tous les titres »** (`features/titres/`) : une famille par culture dans `lib/chemins.ts`, avec le titre
  obtenu et le suivant ; Polymathe à part. La phrase d'un seuil passe par `conditionTitre.ts`.

## Le Hub (`apps/hub`)

- **L'éditeur d'énigmes** (`components/Enigmas.tsx`) ne change pas.
- **Un écran « Cultures »** (nouveau composant, dans son sous-dossier) : pour chaque culture le nom, l'icône
  (image envoyée au storage, comme les photos), la couleur, le complément de titre, actif ou non, et **les
  cercles sur une carte** : un clic pose un centre, un curseur règle le rayon (km), trois cercles au plus.
  MapLibre rejoint le Hub (même bibliothèque que l'appli).
- **Un aperçu** sur la même carte : les éveils en cours de chaque culture, pour voir où tombent les énigmes.
- Le nombre d'énigmes du stock et le total de points par culture, pour suivre les seuils.

## Ce qui ne change pas pour la V1

La V1 reste en ligne jusqu'à la bascule : `get_daily_enigma`, `answer_enigma`, l'énigme du jour et sa
notification de midi (`daily_enigma_lunch_push`, mig 144) restent en place. Seul changement visible chez
elle : 1 XP par énigme juste au lieu de 1 à 3. Leur retrait se fait avec celui de la V1.

## Tests

- **SQL** (`BEGIN … ROLLBACK`, comme `.claude/rules/supabase.md`) : le réveil (cycle, plafond de 7, point
  dans un cercle), `enigmes_en_attente` (percée, ratée, effacée), `percer_enigme` (une seule réponse, refus
  d'un éveil effacé, pas de Couronnes, titres atteints, Polymathe), le rattrapage V1, l'acquis quand le
  total monte.
- **Front (Vitest)** : le seuil d'un palier (plancher contre pourcentage), le nom accordé, la famille d'une
  culture dans `chemins`, la phrase du pied.
- **Navigateur** : dézoomer (éclats), zoomer (sceaux), toucher, répondre juste et faux, voir le sceau
  disparaître, le titre dans « Tous les titres ». `pnpm build` OK.

## Plus tard

Énigmes proposées par la communauté (statut, auteur), Fragments sur la carte (énigme gratuite + vitrine),
bandeau à l'Accueil, notification au réveil, sons propres à chaque culture, le Codex des énigmes percées.
