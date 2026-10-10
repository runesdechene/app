# Le carnet des mises à jour — conception

> 11/10/2026 · V2 (`apps/web-v2`), base (migration 478), edge function `send-push` · pas de maquette :
> les composants du lieu, tels quels · décision dans le `_État.md` d'Explore (Tranché, 11/10)

## Pourquoi

Uriel veut que les Explorateurs puissent réagir aux notes de mise à jour et les commenter : savoir ce
que la communauté pense d'une version, et la faire parler autour. « Plus simple : même fil de
commentaires que sur un lieu, exactement le même, et les cœurs à volonté aussi. Tout pareil »
(11/10). Tout pareil : à volonté sur la note (comme sur un lieu), un par personne sur un mot
(comme sur un mot du Carnet, mig 390).

## Ce que voit le joueur, sur « Nouveautés »

Chaque note reçoit ce qu'a un lieu, avec les **mêmes composants** et le **même comportement** :

- **Les cœurs de la note** — la pastille de cœurs du lieu : à volonté, avec leurs envols ; toucher le
  compte ouvre la feuille de ceux qui en ont envoyé (portrait, nombre), les plus généreux d'abord. On
  ne s'en envoie pas sur sa propre note (l'administrateur qui l'a publiée).
- **Le carnet de la note** — le Carnet de passage :
  - les mots du plus récent au plus ancien, chacun avec ses réponses (un seul niveau, dans l'ordre) ;
  - un mot de 1 à 2000 signes, jusqu'à quatre photos (mêmes contrôles que sur un lieu : le dossier du
    compte, le fichier existe) ; trente mots par jour ;
  - un cœur par personne sur chaque mot, qu'on allume ou éteint (pas sur le sien) — comme sur un
    lieu depuis la mig 390 : sur un mot, le cœur dit « c'est utile », un vote honnête ;
  - « Répondre » ; une réponse à une réponse va sous le mot d'origine ;
  - « Effacer » pour l'auteur du mot ou l'équipe (`_is_staff`) ; ses réponses partent avec lui.
- **Où** : la dernière note (en entier, en haut) montre ses cœurs et son carnet ouverts ; les notes
  précédentes, plus discrètes, montrent leur nombre de cœurs et de mots, et le carnet se déplie au
  toucher.
- **Qui écrit** : tout membre (« Nouveautés » est déjà réservée aux comptes). Pas de condition de
  découverte : une note de mise à jour s'adresse à tous.
- Le Hub ne change pas : la modération se fait depuis l'appli, comme sur un lieu.

## Les notifications

- **Comme le Carnet** : celui à qui l'on répond est prévenu (`comment_reply`) ; le cœur d'une
  personne sur un mot prévient son auteur une seule fois, même éteint puis rallumé (`coeur_mot`).
- **Chaque nouveau mot ou réponse** prévient **tous les administrateurs** (`users.role = 'admin'`),
  sauf celui qui l'a écrit : dans la cloche **et en push** (catégorie `important`, qui suit
  `push_important_enabled`). Un nouveau type, `mot_mise_a_jour`, pour que la cloche et le push disent
  « Luna a commenté « Remonte le temps » » et mènent à « Nouveautés ».
- **Le premier cœur d'une personne sur une note** prévient l'administrateur qui l'a publiée
  (`mises_a_jour.par`) : nouveau type `coeur_mise_a_jour`, dans la cloche et en push, comme le premier
  cœur sur un lieu prévient son auteur.
- Un administrateur prévenu deux fois (il est l'auteur du mot auquel on répond **et** admin) ne reçoit
  qu'une notification : celle de la réponse.

## La base — migration 478

Trois tables de **même forme** que celles du lieu, sans les mêler à `place_contributions` (qui exige
un lieu) :

- `mots_mise_a_jour` : `id`, `mise_a_jour_id → mises_a_jour ON DELETE CASCADE`, `user_id`, `texte`,
  `images jsonb`, `parent_id → mots_mise_a_jour ON DELETE CASCADE`, `created_at`.
- `coeurs_mot_mise_a_jour` : `(mot_id, user_id)` unique — un cœur par personne, comme `coeurs_mot`
  depuis la 390 (avec `premier_le` pour ne prévenir l'auteur qu'une fois).
- `coeurs_mise_a_jour` : `(mise_a_jour_id, user_id)` unique, `nombre > 0` — comme `coeurs_lieu`.

RLS active, aucune policy directe : tout passe par des RPC `SECURITY DEFINER`, réservées à
`authenticated`, calquées sur leurs sœurs du lieu (définitions **live** relues au moment d'écrire la
migration) :

| Lieu (existant) | Mise à jour (nouveau) |
|---|---|
| `carnet_du_lieu(p_id, p_limite)` | `carnet_de_mise_a_jour(p_id, p_limite)` |
| `ecrire_au_carnet(p_id, p_texte, p_images, p_parent)` | `ecrire_sous_mise_a_jour(p_id, p_texte, p_images, p_parent)` |
| `basculer_coeur_mot(p_id)` (390) | `basculer_coeur_mot_mise_a_jour(p_id)` |
| `effacer_mot(p_id)` | `effacer_mot_mise_a_jour(p_id)` |
| `aimer_lieu(p_id)` | `aimer_mise_a_jour(p_id)` |
| `coeurs_du_lieu(p_id)` | `coeurs_de_mise_a_jour(p_id)` |

- Ce qui ne s'applique pas à une note disparaît des copies : « est venu·e » (visite du lieu), la
  condition « a découvert le lieu », l'`activity_log` du lieu.
- `mises_a_jour_publiees()` rend en plus, pour chaque note, son nombre de cœurs, les miens et son
  nombre de mots (réécrite depuis sa définition live, copiée entière).
- `_notification_v2` apprend `mot_mise_a_jour` et `coeur_mise_a_jour` (définition live copiée
  entière).

## Le push — `send-push`

`categories.ts` : `mot_mise_a_jour` et `coeur_mise_a_jour` en `important`. `payloads.ts` : leurs
textes et le lien vers `/accueil/nouveautes` (la route de « Nouveautés » — à vérifier dans le
routeur). L'edge function est redéployée. La liste des notifications du Hub (`catalogueNotifications`)
reçoit les deux types.

## Le code de l'appli

- **Les composants du lieu deviennent communs** : `Carnet`, `EcrireAuCarnet`, la pastille de cœurs
  (`PastilleCoeurs`) et la feuille des cœurs (`FeuilleCoeurs`) ne vont plus chercher leurs données
  eux-mêmes : ils reçoivent les données et les actions (écrire, aimer, effacer) de qui les affiche, et
  passent dans `shared/ui` (page DA comprise). Le lieu les alimente par ses hooks actuels
  (`useCarnet`, `useCoeurs`) : **rien ne change pour le joueur sur un lieu**, ses tests restent verts.
- Ce qui ne vaut que pour un lieu (« est venu·e », le lien vers le profil s'il y en a un, le libellé
  « Féliciter ») reste une option du composant, absente pour une note.
- `features/notifications` : deux hooks, `useCarnetDeMiseAJour(id, limite)` et
  `useCoeursDeMiseAJour(id)`, sur les nouvelles RPC ; `Nouveautes.tsx` affiche la pastille et le
  carnet sous chaque note ; la lecture (`api/nouveautes.ts`) lit les nouveaux comptes.
- La cloche (`features/notifications`) affiche les deux nouveaux types et mène à « Nouveautés ».

## Ne change pas

Le lieu, son carnet et ses cœurs (même rendu, mêmes RPC) ; le Hub et sa page « Mises à jour » ; les
« Annonces » de la V1 et leurs 11 commentaires.

## Tests et vérification

- Les tests du Carnet et des cœurs du lieu passent sans changer leurs attentes.
- `Nouveautes.test.tsx` : la pastille et le carnet sous la dernière note ; une note précédente montre
  ses comptes et déplie son carnet ; écrire, répondre, aimer, effacer appellent les bonnes RPC.
- Les RPC, en transaction annulée sur la prod : écrire (1 à 2000 signes, 30 par jour, photos), une
  réponse à une réponse remonte au mot d'origine, pas de cœur sur son propre mot ni sa propre note,
  effacer (auteur ou équipe seulement), les notifications aux administrateurs (pas à celui qui écrit,
  une seule s'il est aussi l'auteur répondu).
- `send-push` : `payloads.test.ts` pour les deux types.
- Dans le navigateur, sur PC et en largeur téléphone : un cœur sur la note, un mot avec une photo, une
  réponse, un cœur sur un mot, effacer ; la notification arrive dans la cloche d'un administrateur.
