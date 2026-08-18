# App Runes de Chêne — V2 (design)

> Statut : **brainstorm en cours**. Document vivant, complété section par section.
> Rédigé avec Uriel le 18 août 2026. Sections validées : Fondations, Squelette, Compte client, Accueil.
> Restent à concevoir : Carte, Codex, Campement.

## 1. Intention

La V2 est un **fork parallèle** de `apps/explore-web`, développé pendant que la V1 tourne.
Même base de données, même techno. Elle **remplacera la V1** à terme.

Trois qualités visées : **plus simple, plus propre, orientée marque**.

### Le principe qui commande tout

> **La V2 n'enlève pas la progression. Elle enlève la comparaison.**
> « Moi contre moi-même » : je crée mon profil, j'explore, je progresse — et mes pairs
> me **félicitent** au lieu de me classer.

Ce que le porteur vient y chercher : **collectionner** (Codex), **se rassembler**
(Campement), **lire ce que la marque raconte** (Accueil). Ce n'est plus un jeu
compétitif.

### Ce qui ne monte PAS en V2.0

Tout ce qui relève de la **compétition entre joueurs** :

| Système V1 abandonné | Ce que ça représente |
|---|---|
| Coupe des Héritages | classement des Maisons, podium, `get_coupe_state` |
| La Cour — Couronnes, mécénat, veilleurs | `place_court_*`, `invest_crowns` : prendre un lieu à un autre |
| Contestation de lieu | — |
| Compagnies (Maisons, principale/alliée, chef, grades) | mig 295, `factionGroupStore`, Hall, bannières |
| Gloire / XP / niveaux / titres | la progression **comparable** |
| Énigmes (daily, fragment, lieu) | + les 3 crons et la boucle de rétention quotidienne |
| Expéditions joueur-joueur | tables `voyage_*`, chat privé, comptes rendus |
| Quêtes du jour | `dailyQuestsStore`, drip, mini-quêtes |

> ⚠️ **« Quêtes du jour » n'est pas « Missions ».** Les Quêtes étaient la boucle de rétention
> quotidienne, et elles tombent. Les **Missions** — les appels photo de la marque, source
> d'UGC — sont **conservées et portées en V2** : voir §6. Confusion déjà faite une fois ;
> elle aurait tué le système par oubli.

Ordre de grandeur : **60 à 70 % du code de la V1**, une douzaine de tables, la moitié
des RPCs. C'est ce qui rend « minimaliste » atteignable.

⚠️ **Conséquence à traiter le jour de la bascule** (hors périmètre V2.0) : les joueurs
V1 actuels perdront ces systèmes. Le chemin de migration est un chantier à part entière.

### Décidé pour plus tard (hors V2.0)

- **Compagnies, réincarnées** : plus des Maisons qui s'affrontent, mais des **groupes de
  discussion libres** au sein de la communauté. → Conséquence de conception dès
  maintenant : le Campement V2.0 est **un** espace, pas **l'**espace. Un fil appartient à
  un espace dès le départ, même s'il n'y en a qu'un seul. Gratuit aujourd'hui, cher à
  rattraper plus tard.
- **Code imprimé sur le fragment** pour se déclarer porteur (voir §4).

## 2. Cadre technique

- **Fork parallèle** de `apps/explore-web`. Même DB Supabase, même stack
  (React 18 + Vite + TS strict + MapLibre + Zustand).
- **PWA installable.** Pas de coquille native (Capacitor/Tauri) dans ce chantier.
  On conçoit pour que la porte reste ouverte : pas d'API web exotique, navigation au
  pouce, offline soigné.
- Le `@tauri-apps/cli` v1.5 qui traîne dans les deps de `explore-web` (sans `src-tauri`)
  est un reliquat mort — à supprimer.

### Convention V2 ↔ Hub

> Chaque fois qu'une fonctionnalité de la V2 est reliée au Hub, l'élément correspondant
> reçoit dans l'interface du Hub une pastille **« V2 compatible »**.

But : que l'équipe voie d'un coup d'œil ce qui sert la V2. Grain par défaut : **l'entrée
de menu et la section**, pas le champ individuel.

## 3. Squelette de navigation

**Barre d'onglets basse permanente, 4 onglets + avatar.**

```
┌──────────────────────────────┐
│  [avatar]            (Compte) │
│                               │
│         contenu               │
│                               │
├──────────────────────────────┤
│ Accueil  Carte  Codex  Campem.│
└──────────────────────────────┘
```

- Chaque onglet **garde son état** quand on en change.
- L'avatar en haut à droite ouvre le **Compte**.
- Les 4 zones sont **égales** — aucune n'est enterrée sous une autre.

*Écartées* : la Carte comme socle avec le reste en feuilles (c'est la V1, et ça enterre
Codex + Campement) ; l'Accueil comme hall sans barre permanente (deux fois plus de gestes,
et le Campement meurt d'être à deux clics).

*Note DA* : une barre d'onglets est une structure générique **assumée**. « Minimaliste et
fonctionnelle » ne veut pas dire inventer une navigation, mais prendre la plus lisible et
mettre l'originalité dans la matière — icônes gravées, textures, pas de pictos Material.

## 4. Compte client — VALIDÉ

Sous « moi contre moi-même », le Compte n'est **pas une carte de joueur**. Pas de niveau,
pas de titre, pas de rang. C'est le **registre de son propre parcours**.

### Contenu

1. **Identité** — avatar, nom choisi. Rien d'autre.
   (V1 : `users.display_name`, `users.avatar_url`, `users.first_name`.)
2. **Mon parcours** — jalons **personnels**, qui ne se comparent à rien :
   *N lieux visités · N fragments réunis · N régions parcourues · porteur depuis …*
3. **Mon statut de porteur** — voir ci-dessous.
4. **Réglages** — notifications, confidentialité, déconnexion.

### Le lien avec l'achat (la porte du Campement)

Mécanisme réel, vérifié dans la base :

```
Achat Shopify → purchase_log (email, shopify_order_id, unlock_ref_id, status='pending')
                       ↓  match sur l'ADRESSE E-MAIL
               user_fragments (user_id, fragment_id, source='shopify')
                       ↓
               la porte du Campement s'ouvre
```

**Point de fragilité assumé** : tout repose sur une égalité d'adresses e-mail. Commande
avec `perso@gmail.com` + compte avec `pro@boite.fr` ⇒ la ligne reste `pending`
indéfiniment. Sur un fragment **offert**, ce n'est pas un cas limite mais le cas normal.

**Décision V2.0** : on ne construit **pas** de système de codes.

- Le match e-mail couvre le cas normal.
- Le filet existe déjà : `AssignFragments.tsx` dans le Hub permet à l'équipe d'attribuer
  un fragment à la main.
- Le Compte affiche, pour qui n'est pas reconnu porteur, **un chemin clair**
  (« Tu as un fragment mais on ne le voit pas ? Écris-nous ») — jamais une porte close
  sans explication.

*Table `member_codes` (baseline) : morte, référencée nulle part. Ne pas la réveiller sans
décision explicite.*

*Idée gardée pour plus tard* : un **code imprimé** sur la carte du fragment. Ça marche
pour les cadeaux, ça ne dépend d'aucune adresse, et c'est **un geste** — le pont entre
l'objet et le numérique. À reprendre quand l'emballage sera maîtrisé.

## 5. Accueil — VALIDÉ (structure)

Nom de travail : **Le Seuil**.

### Frontière Accueil / Campement

> **L'Accueil, on le lit. Le Campement, on y parle.**

L'Accueil est **descendant** : la marque publie, la communauté vit, le porteur reçoit.
Le seul geste social autorisé y est **saluer** — un tap, un compteur, une notification au
porteur salué. **Pas de commentaire sur l'Accueil** : la conversation appartient au Campement.

**Vocabulaire retenu : « saluer / un salut »**, pas « féliciter » (long pour une pilule, et
ton scolaire).

**Icône retenue : la feuille de chêne**, en SVG maison — on tend une feuille à qui a marché.
C'est littéralement la marque, et ça se compte bien (« 64 feuilles »).

> ⛔ **Pas d'emoji.** Un emoji est dessiné par l'OS : brillant, multicolore, différent sur
> chaque téléphone — le seul élément de l'app hors de ton contrôle, et il jurerait avec le
> parchemin/kaki/rouge sang. 🎉 dit en plus « bravo pour ton diplôme », pas « je reconnais ta
> marche ». *Écarté aussi : le gland — « 64 glands » en français, ça part en vrille.*

### Structure, dans l'ordre du scroll

| # | Bloc | Contenu |
|---|---|---|
| 1 | **Nouveauté de la marque** | Le seuil éditorial. Fragment du mois, collection, récit, changement de saison. Grande image, pastille de type, titre, chapô, un lien. |
| 2 | **L'appel** *(conditionnel)* | La mission ou le rendez-vous en cours (§6). Image, appel, ce qu'on attend, échéance, un bouton pour entrer. |
| 3 | **Autour de toi** | Carrousel horizontal des lieux **les plus proches**, avec leur distance. Le bloc qui pousse dehors. |
| 4 | **Bandeau Saga** | Le seul bloc ouvertement commercial. Une collection Saga : nom, « N motifs · N pièces », un lien vers la boutique. |
| 5 | **Sur les chemins** | Le flux d'activité. Lignes brèves : pastille de type, phrase, méta, bouton **Saluer**. |
| 6 | **Le plus salué** *(conditionnel)* | Le contenu ayant reçu le plus de saluts ces derniers jours — récit, trouvaille, photo de porteur. Carte à vignette + compteur de saluts + auteur. |

**Deux blocs conditionnels, et c'est volontaire.** La page respire entre 4 et 6 blocs selon
ce qui est vivant. Sans appel en cours, « Autour de toi » remonte en position 2 — la place
qu'on lui avait validée. Sans contenu salué, le bas de page s'arrête sur le flux.

**Pourquoi « Autour de toi » est monté si haut.** C'était le bloc 5, tout en bas, « rarement
vu — alors que c'est le seul bloc qui pousse dehors ». Trié par **proximité** au lieu de par
fraîcheur, il est plein dès le premier jour pour tout le monde : il n'attend aucune
communauté. Il règle du même coup le démarrage à froid de l'ancien bloc 2, qui supposait des
saluts avant qu'il n'y ait qui que ce soit pour saluer.

**Repli si la géolocalisation est refusée**, ou si le porteur est loin de tout (vacances,
étranger) : le bloc montre les lieux **récemment ajoutés**, sans distance. C'est l'ancien
comportement du bloc 5, qui devient le repli au lieu d'être la règle — le bloc ne se vide
jamais.

**Pourquoi « L'appel » est si haut.** Il porte une échéance. Un appel qui expire dans trois
jours n'a rien à faire en bas de page.

**Le bandeau Saga** est traité en **kaki plein** (`scheme-3`), à l'inverse du parchemin des
blocs communautaires : on voit d'un coup d'œil que c'est la marque qui parle, sans avoir à
écrire « publicité ». Sagas réelles de la boutique : `garde-d-acier`, `les-mysteres-celtes`,
`lombre-et-lairain`, `le-pacte-sauvage`.

> ⚠️ **Un seul bandeau, jamais deux.** Pour pousser plusieurs Sagas, un carrousel de Sagas —
> pas un empilement de bandeaux, sinon l'Accueil devient un catalogue et la communauté passe
> au second plan.

**Ce que devient l'activité, sans compétition.** Le flux dit qui *vit*, pas qui gagne :
« Marie a visité le Château de Ranrouët », « Paul a réuni son 3ᵉ fragment »,
« Louis a posté au Campement ». Aucun score, aucun rang, aucun « +12 Gloire ».

Le bloc « Le plus salué » est **classé par la communauté, pas par la marque** — et se garde
de devenir un classement de *personnes* : on met en avant un contenu, jamais un porteur.

### L'état vide (premier jour) — validé

Sans lieu visité, les blocs communautaires (**5 Sur les chemins**, **6 Le plus salué**)
seraient des listes d'inconnus. Alors :

- le seuil **grandit**, pastille « Bienvenue », ton d'accueil
  (*« Ici, on ne gagne rien contre personne. On marche, on trouve, on garde trace. »*) ;
- une **invitation concrète** prend la place des blocs communautaires : combien de lieux
  attendent, à quelle distance est le plus proche, puis « Ouvrir la Carte » ;
- l'onglet **Campement apparaît cadenassé mais visible** — on voit qu'il existe, c'est ce
  qui donne envie d'y entrer. Le tap mène à la marche à suivre, jamais à une porte close.

> ⚠️ **Révision du 18/08 — redondance à trancher en maquette.** « Autour de toi » (bloc 3)
> dit déjà quels lieux attendent et à quelle distance : il fait une partie du travail de
> l'invitation. Soit l'invitation se réduit à la phrase d'accueil et laisse le carrousel
> faire le reste, soit elle disparaît et le carrousel remonte en 2. **Ne pas afficher les
> deux** — le nouveau venu lirait deux fois la même chose.

### DA — source de vérité

La direction artistique vient de **la boutique `runesdechene.com`** (thème Crépuscule,
`config/settings_data.json`), **pas** de l'app V1 :

| Rôle | Valeur | Origine |
|---|---|---|
| Fond parchemin | `#f4eee1` | scheme-1 `background` |
| Surface crème | `#f6eddd` | scheme-3 `foreground` |
| Titres | `#403434` | scheme-1 `foreground_heading` |
| Texte | `#594848` | scheme-1 `foreground` |
| **Accent — rouge sang** | **`#833434`** | scheme-1 `primary` |
| Rose poudré | `#ebd2d2` | scheme-1 `secondary_button_background` |
| Kaki forêt | `#46493c` | scheme-3 `background` |
| Sable | `#e7dcca` | scheme-1 `variant_background_color` |
| Titres | **Bebas Neue** | `type_heading_font` |
| Corps | **Cabin** | `type_body_font` |

⚠️ L'app V1 utilise un sépia doré (`#C19A6B`) **absent de la boutique**. La V2 s'aligne sur
la boutique : le rouge sang remplace le sépia comme accent.

**Qui fait quoi.** La direction artistique est faite **par Uriel, dans Figma**. Les ébauches
produites en brainstorm (artefact « Le Seuil ») ne servent qu'à trancher la **structure** —
quels blocs, dans quel ordre, quel geste, quel état vide. **Ce ne sont pas des références
graphiques** : ne pas s'en servir comme source de vérité visuelle.

### Arbitrages laissés à la maquette Figma

- ~~**Longueur du scroll** : le carrousel est tout en bas, donc rarement vu.~~ **Réglé le
  18/08** — il est monté en bloc 3. Reste à surveiller : à 6 blocs le scroll approche
  3 hauteurs de téléphone. Les deux blocs conditionnels sont ce qui l'empêche de filer.
- ⚠️ **Régression introduite le 18/08** : « Le plus salué » et « Sur les chemins » montraient
  tous deux la communauté et risquaient de se confondre ; le bandeau Saga les séparait, bon
  effet de bord non prévu. Le réordonnancement les a rendus **voisins** (5 et 6). À revérifier
  en maquette : si la confusion revient, intervertir « Le plus salué » et le bandeau Saga.
- **Bandeau « RUNES DE CHÊNE »** en haut : mange une ligne sur chaque écran. Alternative :
  avatar seul.
- **Densité du flux** : curseur entre « on voit la vie » et « on lit bien ».

## 6. L'appel — missions & rendez-vous

**Nom retenu : « L'appel ».** Il marche pour les deux formes (« l'appel du mois », « on se
retrouve à… ») et la colonne `missions.call` porte déjà ce mot. Écarté : *événement*, correct
mais tiède ; *rassemblement*, qui ne couvre que le physique.

### Un seul objet, deux types

| | **Mission** | **Rendez-vous** |
|---|---|---|
| Ce que c'est | un appel photo/vidéo de la marque | un vrai rassemblement, quelque part |
| Lieu | aucun — on le remplit où on veut | **un lieu et une heure** |
| Ce qu'on rapporte | de l'**UGC** et de la conversion | des **gens** |
| Portée | ceux qui sont déjà entrés | ceux qui n'ont jamais entendu parler de la marque |

Tout le reste est commun : un appel, un brief, une image, une fenêtre de dates, un produit
lié, un statut, des participants, un salon.

**Un rendez-vous ramène du monde parce qu'il existe dehors** — il se raconte, se photographie,
intéresse la presse locale et le site patrimonial qui le relaie à ses propres visiteurs. C'est
la seule chose de toute l'app qui puisse atteindre quelqu'un d'extérieur.

### Ce qui existe DÉJÀ en production — ne rien reconcevoir

| Où | Quoi |
|---|---|
| **Base** | `missions` (appel, brief, fenêtre, produit lié, statut, `featured_on_home`) · `mission_participants` · `mission_messages` + `mission_message_reads` (un salon par appel). Migs 184, 194, 208, 209, 239, 326. |
| **Hub** | `Missions.tsx` (créer/publier), `missions/MissionProductPicker.tsx` (lier au produit), `Photos.tsx` + `photos/ImageCurator.tsx` + `photos/SubmissionDetail.tsx` (modérer l'UGC) |
| **App V1** | `components/missions/MissionModal.tsx` — voir un appel, le rejoindre |
| **Soumissions** | `hub_photo_submissions` : `mission_id`, modération `pending/approved/archived`, et **`consent_brand_usage`** — le droit de réutilisation est déjà collecté |
| **Boutique** | RPC anon `get_community_photos_by_product` → mur « Ils nous portent » sur la fiche produit |

La boucle est **complète et bouclée** : appel publié depuis le Hub → participation → envoi de
photos → modération → publication sur la fiche produit du vêtement concerné.

### À nettoyer au portage V2

- **`floor_glory` et `floor_crowns`** — les appels sont aujourd'hui verrouillés par un plancher
  de Gloire et de Couronnes, les deux systèmes que la V2 supprime (§1). À retirer, sinon les
  appels deviennent inaccessibles ou incohérents.
- **`emblem` vaut `'🎯'` par défaut** — les emoji sont interdits en V2 (§5) : dessinés par l'OS,
  différents sur chaque téléphone, ils jureraient avec le parchemin. À passer en SVG maison,
  comme la feuille de chêne.

### Le delta technique pour ouvrir les rendez-vous

Petit : un champ **`kind`** (`mission` | `rendez_vous`) et un **lien optionnel vers un lieu** —
les lieux sont déjà en base avec leurs coordonnées. Un rendez-vous peut donc s'afficher **sur
la Carte**, ce qui est cohérent avec le reste de l'app.

> **Garder le nom de table `missions`.** La renommer en `events` obligerait à toucher le Hub
> et le mur de la boutique pour zéro bénéfice. Le vocabulaire affiché dit « L'appel » sans que
> la base change de nom.

### ⛔ Contrainte pour la conception du Campement

Un rendez-vous est le meilleur outil de recrutement de la marque, et une mission photo accepte
**déjà** les gens sans compte (`hub_photo_submissions.user_id` nullable, `consent_account_creation`
prévu). Mais le salon d'un appel est du Campement — donc fermé aux non-porteurs.

**La face publique d'un appel doit vivre hors du portail ; seule la conversation reste
derrière.** Sinon le nouveau venu que le rendez-vous a fait marcher avec vous se cogne à une
porte close, une photo à la main. À traiter en §9, pas après.

### Ce qui n'est PAS un appel

Un appel **rassemble, il ne classe pas**. Pas de gagnant, pas de podium, pas de « meilleure
photo ». C'est un appel, pas un concours — sinon on réinstalle la compétition que la V2 retire.

## 7. Carte

*(à concevoir)*

- Y afficher les **rendez-vous** en cours (§6), qui portent un lieu.

## 8. Codex

*(à concevoir)*

- **Carrousel produits** — décidé le 18/08. Il vient ici, pas sur l'Accueil : devant un motif
  qui plaît, l'envie d'acheter existe déjà ; sur l'Accueil elle serait interrompue. Garde
  l'Accueil à **un seul** bloc commercial (le bandeau Saga).

## 9. Campement

*(à concevoir)*

- Traiter la **contrainte du portail** posée en §6.

## Points ouverts

- Ordre de construction retenu par Uriel : **Compte client → Accueil → Carte**, puis
  Codex et Campement.
- Uriel réalise les maquettes dans **Figma** à partir de ces sections ; la DA se fixe là.
- « Félicité par ses pairs » a besoin de pairs. Sur un Campement peu peuplé, poster sans
  recevoir de salut se vit plus mal qu'une absence de fonctionnalité. À traiter en
  concevant le Campement.
- Chemin de bascule V1 → V2 pour les joueurs existants : chantier séparé, non commencé.
