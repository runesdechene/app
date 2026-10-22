# Le Campement — conception

> Brainstorming avec Uriel, 22/10/2026. Remplace §9 de `2026-08-18-app-v2-design.md` (qui y renvoie)
> pour la place, l'accès et le contenu ; en garde les règles du vote, l'archive et la porte.
> Décisions courtes : `_État.md` d'Explore dans le vault. *[mon choix]* = décision de Claude, à relire.

## 1. Intention

Explore est le cadeau qui convertit ; **le Campement fidélise**. C'est la taverne, le coin du feu
des Porteurs : on s'y retrouve, on y partage ce qu'on découvre, on y décide avec la marque, on s'y
donne rendez-vous. La marque y vend **la confrérie secrète**, la communauté.

Le ton : **des explorateurs érudits**. Le périmètre : l'Histoire, l'esprit d'aventure, la nature,
le patrimoine, la musique quand elle porte cet esprit — ce qui fait s'évader du monde moderne.

**Objectifs** : que les Porteurs reviennent sans qu'on les relance ; que la marque ait un lieu
pour parler à ses clients (vote, vente privée) ; qu'un Porteur nomade ou sédentaire puisse
retrouver les autres en vrai.

**Non-objectifs** : la version « compte client » sur la boutique (plus tard) ; le jeu (batailles
d'Âmes, après) ; un outil d'événements complet (le rendez-vous reste léger).

**Anti-objectifs** : compliqué à comprendre — Uriel : « très simple, on vend un produit » ; un
classement de personnes ; un réseau social de plus (politique, polémique, bruit moderne) ; un vote
que la marque n'honore pas.

## 2. Accès

- **Tout le Campement est réservé aux Porteurs** (≥ 1 Fragment), coin du feu compris (Uriel,
  22/10 — remplace « on ouvre ce qui grandit » du 19/08). Le canal général de Messages reste ouvert.
- Porteur = une ligne dans `user_fragments` (portail `purchase_log` → `user_fragments`, §4 de la
  spec V2, rien à construire). Accès à vie.
- **La porte** (sans Fragment) : l'onglet est visible, cadenassé. Le toucher montre ce qui se
  passe derrière sans le donner — le nombre de Porteurs, le sujet du vote en cours et ses voix,
  les derniers sujets du coin du feu, à demi voilés ; **jamais les motifs candidats**. Puis
  « Rejoins la Confrérie » → la boutique. *[mon choix : le contenu exact de l'aperçu]*

## 3. Place dans l'appli

- **Un onglet**, pas un interrupteur (écarté : personne ne pense à le toucher).
  Barre : **Explore · Carte · Campement · Messages · Compte**. `/campement` ouvre l'onglet.
- **Les Compagnies quittent la barre** : sur téléphone, elles passent dans le menu dépliant du
  Compte (`MenuDuProfil`) (Uriel, 22/10). *[mon choix : pareil sur PC]*
- L'appli s'ouvre sur Explore sans Fragment, sur le Campement dès qu'on en a un (08/10).
- **Téléphone** : un écran, comme les autres onglets.
- **PC** : l'onglet Campement prend **la place de la carte** (la coquille garde aujourd'hui la
  carte toujours visible, `app/shell/Shell.tsx`). La colonne de gauche montre **Messages**, ouvert
  sur le canal des Porteurs, ou **le Codex** à sa place. Tout autre onglet ramène la carte.

## 4. L'écran du Campement

De haut en bas :

1. **La parole de la marque** — un seul emplacement, une chose à la fois, seulement quand il y en
   a une : un **vote**, une **vente privée** ou une annonce.
2. **Le coin du feu** — un fil, trois sortes de lignes :
   - **la découverte** (§5) ;
   - **le rendez-vous** (§6) ;
   - **l'activité** : un Porteur rejoint la Confrérie ou achète un nouveau Fragment, réussit
     quelque chose (énigme, titre…). *[mon choix : la liste exacte, prise parmi les événements
     déjà produits pour l'Accueil]*
3. **L'entrée du Codex** (téléphone ; sur PC il est dans la colonne de gauche).

**Un seul geste partout : lever sa chope** — comme le salut de l'Accueil : un compteur, l'auteur
prévenu, pas de liste de noms. *[mon choix]* Il s'applique sur une découverte, un rendez-vous, une activité.
*[mon choix : pas de second geste ; « saluer » et sa feuille restent à l'Accueil Explore]*

## 5. La découverte — « lever sa chope »

Comme on lève son verre pour raconter quelque chose à la table. Exemple d'Uriel : un livre sur
Pline l'Ancien qu'il veut partager à toute la communauté.

- **Le contenu est un fond de story** : du texte, une photo, un audio, une vidéo — et toute
  combinaison (une photo et un audio, avec du texte).
- La mise en scène dit le toast, pas le post : « Uriel lève sa chope : … », gravure de chope.
- **Le tour de table** : la discussion sous la découverte, où chacun donne son avis. *[mon choix :
  son propre fil par découverte, sur le modèle de `mission_messages` ; distinct du canal des
  Porteurs de Messages, qui est à créer dans `chat_messages`]*
- **La découverte reste** : « story » est le format, pas l'éphémère. Photo, vidéo, audio se
  prennent ou se choisissent avec les outils du téléphone ; limites de durée et de poids au
  builder. *[mon choix]*
- Tout Porteur en poste ; le geste doit être aussi léger qu'une story.

## 6. Le rendez-vous

Exemple d'Uriel : nomade, il passe dans une région et veut y retrouver ses fans et ses amis.

- Tout Porteur peut en lancer un : un **lieu de la Carte**, des dates, « J'y serai ».
- *[mon choix]* C'est l'**appel de type rendez-vous** déjà prévu (§6 de la spec V2) : table
  `missions` (+ `kind`, lien vers un lieu), son salon `mission_messages`. Lancé par un Porteur.
- **Public ou réservé**, au choix de celui qui le lance (Uriel, 22/10). Public : un non-Porteur le
  voit **seulement sur la Carte**, jamais au Campement. Réservé : Porteurs seuls.
- Prévenir d'abord les Porteurs de la zone : voir §10.

## 7. Le vote

Seule la marque en lance. Exemple : les motifs du prochain Fragment mythologique ; aussi les
prochains festivals. **L'e-mail l'annonce, on vote au Campement.** Règles reprises de §9 de la
spec V2 : un choix entre des candidats, jamais une question ouverte ; un Porteur, une voix ; totaux
publics, voix anonymes ; le score se découvre après avoir voté ; l'engagement de la marque écrit
dans l'écran ; **l'archive** garde les décisions et les refus motivés.
**Les initiatives à seuil** (§9 de la V2) ne montent pas au lancement : l'archive ne garde que
les votes. *[mon choix]*
**Le Hub** a ses écrans dès la première version : créer un vote (candidats, échéance, texte
d'engagement), publier une annonce ou une vente privée, écrire la décision. *[mon choix]*
À voir en base : `territory_name_proposals` / `territory_name_votes` (gelées, mig 274).

## 8. Ce qui appartient au Porteur

- **Le Codex** : la décision du 22/10 remplace « le Codex a quitté Explore, il vit dans la
  boutique » (28/09, cité dans `features/compte`). **Lot à part, après le cœur du Campement.**
  *[mon choix : l'ordre]* Contenu : §8 de la spec V2 (registre de ce que tu as, rangées à trous). Une zone entière,
  **pas dans le Compte**, déjà plein.
- **Les Couronnes** et **le code de parrainage** : au Compte. Barème du 28/09 (`_État.md`).
  Tables V1 `user_crowns` gardées avec leurs soldes (`docs/v2/purge-back.md`) ; les gains V1
  sont coupés.
- **Les ventes privées** : annoncées dans la parole de la marque.

## 9. Ce qui existe déjà

Portail Porteur (`user_fragments`) · Messages et ses canaux (`chat_messages`, `ChoixCanal`) ·
appels et salons (`missions`, `mission_messages`) · récit et voix off d'un Fragment
(`features/fragments`, `LecteurAudio`) · `saluts` (le geste de l'Accueil, modèle possible pour la
chope) · `user_crowns`. Le builder part de là avant de créer.

## 10. Ouvert

- **Le Codex sur téléphone** : où est son entrée exacte (à trancher en maquette).
- **Les ventes privées** : le mécanisme côté Shopify (code, lien réservé, fenêtre).
- **Les Couronnes à la caisse** : comment 100 Couronnes deviennent 5 € sur la boutique.
- **« Les Porteurs de la zone »** : d'où vient la région d'un Porteur (donnée sensible).
- **Modération** d'un fil réservé : qui retire quoi (l'équipe, comme pour Messages ?).
- **Le coin en haut à droite** est chargé (scan, « + », cloche) : rien n'y est ajouté, à vérifier
  en maquette.
- La maquette Figma, téléphone et PC, avant tout code.
