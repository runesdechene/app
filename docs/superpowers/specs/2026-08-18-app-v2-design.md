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

> **Collectionner n'est pas se comparer — précision du 19/08.** Le complétionnisme a été
> écarté deux fois dans la journée (le compteur de la Carte, puis le Codex) **à tort**. Une
> grille à trous, c'est moi contre moi-même ; un classement, c'est moi contre les autres.
> **Seul le second tombe.** Le principe interdit la comparaison, pas la collection.

### Ce qui ne monte PAS en V2.0

Tout ce qui relève de la **compétition entre joueurs** :

| Système V1 abandonné | Ce que ça représente |
|---|---|
| Coupe des Héritages | classement des Maisons, podium, `get_coupe_state` |
| La Cour — Couronnes, mécénat, veilleurs | `place_court_*`, `invest_crowns` : prendre un lieu à un autre |
| Contestation de lieu | — |
| Compagnies (Maisons, principale/alliée, chef, grades) | mig 295, `factionGroupStore`, Hall, bannières |
| Gloire / XP / niveaux | la progression **comparable** |
| Énigmes (daily, fragment, lieu) | + les 3 crons et la boucle de rétention quotidienne |
| Expéditions joueur-joueur | tables `voyage_*`, chat privé, comptes rendus |
| Quêtes du jour | `dailyQuestsStore`, drip, mini-quêtes |

> ✅ **Les Titres restent — corrigé le 19/08.** Ils figuraient à tort dans cette liste. Un
> titre V2 (« Hoplite », « Demiurge »…) **est offert avec l'achat d'un fragment** : il ne se
> gagne contre personne et ne classe personne, il vient avec l'objet. C'est un marqueur
> d'identité et d'appartenance, pas un rang. Ce qui tombe, c'est la progression *comparable* —
> Gloire, XP, niveaux.

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
  maintenant : le **registre** V2.0 (§10) est **un** espace, pas **l'**espace. Un message
  appartient à un canal dès le départ, même s'il n'y en a que deux. Gratuit aujourd'hui, cher
  à rattraper plus tard. *(Visait le Campement avant la révision du 19/08 ; c'est le registre
  qui porte la discussion.)*
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
- **Le registre (le chat) n'est pas un onglet** : c'est un **tiroir ouvrable depuis n'importe
  quel écran** (§10). Décision du 19/08 — dans un MMO le chat n'est pas une zone, c'est un
  panneau ; on discute *en regardant la carte*.

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

### Frontière entre les lieux

> **L'Accueil, on le lit. Le registre, on y parle. Le Campement, on y décide.**

L'Accueil est **descendant** : la marque publie, la communauté vit, le porteur reçoit.
Le seul geste social autorisé y est **saluer** — un tap, un compteur, une notification au
porteur salué. **Pas de commentaire sur l'Accueil** : la conversation appartient au registre.

> **Révision du 19/08.** La formule d'origine était « l'Accueil on le lit, le Campement on y
> parle ». Le Campement n'est plus la discussion (§9) : la conversation a migré vers le
> **registre**, un tiroir ouvert à tous (§10). La frontière compte désormais trois lieux.

**Vocabulaire retenu : « saluer / un salut »**, pas « féliciter » (long pour une pilule, et
ton scolaire).

**Icône retenue : la feuille de chêne**, en SVG maison — on tend une feuille à qui a marché.
C'est littéralement la marque, et ça se compte bien (« 64 feuilles »).

> **Maquette du 18/08 — moratoire, pas revirement.** Uriel garde des emoji dans la maquette
> Figma (📷 mission, ⛺ festival) : ils donnent une illustration en couleur tout de suite et
> se remplaceront par des dessins maison. **L'interdit ci-dessous tient pour la mise en
> ligne** ; les emoji sont des repères provisoires de maquette, pas une décision de DA. Le
> vocabulaire de remplacement existe déjà — les intertitres de la maquette portent de belles
> icônes gravées (rouleau, sapin, bannière).

> ⛔ **Pas d'emoji.** Un emoji est dessiné par l'OS : brillant, multicolore, différent sur
> chaque téléphone — le seul élément de l'app hors de ton contrôle, et il jurerait avec le
> parchemin/kaki/rouge sang. 🎉 dit en plus « bravo pour ton diplôme », pas « je reconnais ta
> marche ». *Écarté aussi : le gland — « 64 glands » en français, ça part en vrille.*

### Structure, dans l'ordre du scroll

| # | Bloc | Contenu |
|---|---|---|
| 1 | **Nouveauté de la marque** | Le seuil éditorial. Fragment du mois, collection, récit, changement de saison. Grande image, pastille de type, titre, chapô, un lien. |
| 2 | **L'appel** *(conditionnel)* | La mission ou le rendez-vous en cours (§6). Image, appel, ce qu'on attend, échéance, un bouton pour entrer. |
| 3 | **Ajoutés récemment** | Carrousel horizontal des lieux **fraîchement ajoutés**, avec leur distance et leur contributeur. |
| 4 | **Bandeau Saga** | Le seul bloc ouvertement commercial. Une collection Saga : nom, « N motifs · N pièces », un lien vers la boutique. |
| 5 | **Sur les chemins** | Le flux d'activité. Lignes brèves : pastille de type, phrase, méta, bouton **Saluer**. |
| 6 | **Le plus salué** *(conditionnel)* | Le contenu ayant reçu le plus de saluts ces derniers jours — récit, trouvaille, photo de porteur. Carte à vignette + compteur de saluts + auteur. |

**Deux blocs conditionnels, et c'est volontaire.** La page respire entre 4 et 6 blocs selon
ce qui est vivant. Sans appel en cours, le carrousel de lieux remonte en position 2. Sans
contenu salué, le bas de page s'arrête sur le flux.

**Pourquoi le carrousel de lieux est monté si haut.** C'était le bloc 5, tout en bas,
« rarement vu — alors que c'est le seul bloc qui pousse dehors ». Il est plein dès le premier
jour pour tout le monde : il n'attend aucune communauté, et règle du même coup le démarrage à
froid de l'ancien bloc 2, qui supposait des saluts avant qu'il n'y ait qui que ce soit pour
saluer.

> **Tri : fraîcheur, pas proximité — tranché par Uriel le 18/08.** Un tri par proximité avait
> été proposé pour garantir que le bloc pousse *vraiment* dehors. Uriel garde les **ajouts
> récents** : c'est le fil de la vie de la carte, pas un GPS. **Conséquence assumée** : la
> distance affichée peut être grande (170 km, 342 km en maquette) — le bloc raconte alors ce
> que la communauté découvre, plutôt qu'il n'invite à sortir aujourd'hui. Si la contradiction
> gêne un jour, la sortie douce est un **filtre de rayon sur les ajouts récents**, pas un
> changement de tri.

Si la géolocalisation est refusée, la distance disparaît ; le bloc, lui, ne se vide jamais.

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

### Le flux « Sur les chemins » — langage visuel (maquette des 18-19/08)

**Les lignes du flux posent à nu sur le parchemin** — pas de carte, pas de fond, pas de coin
arrondi. Décision de maquette : les gravures et l'entrelac disent « imprimé », des cartes
arrondies partout disaient « iOS ». Effet de bord gagné : le flux est devenu plus discret que
les blocs du haut, ce qui donne enfin à la page **deux tempos** au lieu d'un seul.

> Conséquence : le filigrane de fond passe désormais **sous** le texte du flux, qui n'a plus de
> carte pour le protéger. Il reste lisible aux opacités actuelles — **ne pas les monter**.

**Le type d'activité est porté par l'icône de gauche**, et par elle seule : empreintes pour
une visite, ⊕ pour un ajout de lieu, blason pour un fragment réuni. C'est gros, c'est au
début de la ligne, c'est là que l'œil tombe.

**La feuille de salut garde une seule couleur.** Elle est la marque et le seul geste social
de l'app : une marque qui existe en quatre couleurs sur un même écran cesse d'être une
marque. La couleur y encode **l'état, pas le type** — pleine en rouge sang quand j'ai salué,
en contour discret sinon. Binaire, vrai partout.

**Deux couleurs, deux rôles, aucun recouvrement** — tranché par Uriel en maquette le 18/08 :

| Couleur | Ce qu'elle veut dire | Où |
|---|---|---|
| **Rouge sang** `#833434` | **une action, un état** | pastille de salut, boutons. **Jamais un lien.** |
| **Ocre doré** `#8A6F3A` | **une activité notable** | le nom, dans une ligne de fragment réuni ou d'ajout de lieu |
| Brun `#403434` | une activité ordinaire | le nom, dans une ligne de visite |

**Ce n'est pas une couleur par type d'activité, et c'est pour ça que ça tient** : l'ocre encode
un axe **binaire** — notable ou ordinaire — exactement comme la feuille encode salué ou pas.
Un seul axe par teinte. Une couleur par type aurait imposé d'inventer une hue par catégorie et
l'Accueil se serait mis à ressembler à un fil d'actualité générique.

> Le lien bleu-violet d'une première maquette (couleur par défaut du navigateur) est **hors
> palette, écarté**.

> **Comment l'ocre a été choisi — tranché le 19/08.** Le premier ocre proposé, `#A89369`,
> donnait **2,58:1** sur parchemin, très en dessous du seuil de 4,5:1 : le nom du lieu pesait
> visuellement *moins lourd que sa propre méta grise*, alors que c'est lui l'information.
> Symptôme plus parlant que le chiffre. Trois candidats comparés à taille réelle sur vrai
> parchemin ; `#7D6330` (4,91:1) passait la norme mais tirait tellement vers le brun qu'il ne
> se distinguait plus d'une ligne ordinaire — il perdait la seule chose que l'ocre doit faire.
> **`#8A6F3A` retenu : 4,11:1.** Garde l'or, passe devant sa méta.
>
> ⚠️ **Écart assumé** : 4,11 reste sous le seuil AA du texte courant (4,5) et au-dessus de
> celui du gros texte (3). Si on veut la conformité pleine sans changer la teinte, il suffit de
> composer le nom en **gras à 19 px ou plus** — il bascule alors dans la catégorie « gros
> texte », où 3:1 suffit.

> ⚠️ **À surveiller** : ici 2 lignes sur 3 sont ocre. Si les ajouts et les fragments deviennent
> majoritaires — ce qu'on veut — le marqueur s'aplatit. Il dégrade mieux qu'un cadre (une
> couleur de texte à 70 % de densité reste calme là où des bordures deviendraient du bruit),
> mais à regarder sur dix lignes avant de figer.

**Le type ne doit jamais reposer sur la seule couleur** — une partie des daltoniens ne
distinguerait pas trois teintes proches. L'icône de gauche règle ça pour tout le monde.

**Les contributions se distinguent par l'ocre, pas par un cadre.** Un ajout de lieu est le
seul acte du flux qui *agrandit la carte* : c'est lui qui fait grossir le produit, et il mérite
de se voir. Une maquette intermédiaire l'encadrait de doré ; le cadre est **tombé avec les
cartes** quand le flux est passé à nu sur le parchemin, et l'ocre l'a remplacé. Bon échange :
même intention, sans carte ni bordure, et ça vieillit mieux — un cadre calibré sur « c'est
rare » devient du bruit le jour où les ajouts se multiplient.

**Retenu, à maquetter par Uriel (19/08)** : **la vignette du lieu ajouté** s'affiche sur la
ligne. C'est la seule activité qui apporte un objet nouveau ; le montrer pèse plus lourd
qu'une teinte, ne dépend pas de la rareté, et fonctionne sur parchemin nu.

### Ce qui a le droit d'entrer dans le flux (19/08)

La V1 écrit une quarantaine de types dans `activity_log`. **La moitié meurt avec la
purification** (§1), sans filtre à écrire : `place_taken_remote`, `place_taken_back_gps`,
`place_reaffirmed`, `place_court_attack/support/high_threat`, `invest_crowns`,
`crowns_awarded`, `faction_join`, `faction_leave`, `level`, `level_up_imminent`, toute la
famille `expedition_*`, tous les `enigma_*`.

**Ce qui survivrait et qu'il faut traiter** : `revisit_gps` / `revisit` (quelqu'un qui habite
à côté d'un lieu produit une ligne par jour, à vie — le pire parasite), `places_viewed` et
`place_not_found` (de la télémétrie, pas des événements), `place_position_edited`,
`place_tags`, `place_influence` (micro-corrections vraies mais illisibles).

**La vraie frontière est « une ligne ou un indicateur »**, pas « avec ou sans bouton » :

| | Ce que ça dit | Exemples | Forme |
|---|---|---|---|
| **Événements** | *quelqu'un a fait quelque chose, ou vient d'arriver* | première visite · ajout ou enrichissement de lieu · fragment réuni · réponse à un appel · post au Campement · **arrivée d'un nouveau porteur** | une **ligne**, avec bouton Saluer |
| **Présence** | *il y a du monde ici* | connexions | **pas de ligne** — un indicateur ambiant |

**Tout ce qui entre dans le flux porte un bouton Saluer** — tranché par Uriel le 19/08. Une
étape intermédiaire prévoyait un second registre de lignes non saluables ; l'arrivée d'un
nouveau porteur en était le seul exemple, et elle est finalement **saluable**. Le registre est
donc tombé : si une ligne ne mérite pas d'être saluée, elle ne mérite pas d'être une ligne.

> **Conséquence sur le vocabulaire.** La feuille voulait dire « je reconnais ta marche ». Elle
> en dit maintenant deux choses, très proches : **je reconnais ta marche**, et **bienvenue**.
> Tendre une feuille à qui arrive, dans une app dont le seul geste est de saluer, c'est un
> accueil. Cohérent — mais à garder en tête si un jour on écrit un libellé unique pour le geste.

**Inscription ≠ connexion.** Une inscription arrive une fois par personne, à vie : vrai
événement, elle a sa ligne (« Camille a rejoint les chemins »). Une connexion arrive dix fois
par jour et par personne : mise en ligne, c'est le pire flood de tous, et ça ne raconte rien.
L'information reste bonne à donner, sous une **autre forme** — un indicateur ambiant
(« 14 porteurs sur les chemins aujourd'hui », ou des avatars empilés en tête de section).

**Deux garde-fous mécaniques**, quel que soit le registre :

- **Pas de revisite** — seule la *première* visite d'un lieu par une personne produit une ligne.
- **Une ligne par personne, par type, par jour** — sinon une seule personne active occupe tout
  l'écran, et le flux cesse de dire « la communauté vit » pour dire « Luna vit ».

> **Le risque inverse, à ne pas perdre de vue.** Après ce ménage il reste cinq types d'actes.
> Sur une communauté jeune, le danger devient un flux **trop maigre** — une page qui s'arrête
> sur deux lignes est plus triste qu'une page bavarde. Le filet est **l'appel** : « Luna a
> répondu à l'appel » est périodique, déclenché par la marque, et arrive en grappe pendant la
> fenêtre de la mission. C'est le seul robinet du flux qu'on contrôle.

### L'état vide (premier jour) — validé

Sans lieu visité, les blocs communautaires (**5 Sur les chemins**, **6 Le plus salué**)
seraient des listes d'inconnus. Alors :

- le seuil **grandit**, pastille « Bienvenue », ton d'accueil
  (*« Ici, on ne gagne rien contre personne. On marche, on trouve, on garde trace. »*) ;
- une **invitation concrète** prend la place des blocs communautaires : combien de lieux
  attendent, à quelle distance est le plus proche, puis « Ouvrir la Carte » ;
- l'onglet **Campement apparaît cadenassé mais visible** — on voit qu'il existe, c'est ce
  qui donne envie d'y entrer. Le tap mène à la marche à suivre, jamais à une porte close.

> ⚠️ **Révision du 18/08 — redondance à trancher en maquette.** Le carrousel de lieux (bloc 3)
> dit déjà quels lieux existent et à quelle distance : il fait une partie du travail de
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
| **Ocre doré** | `#8A6F3A` | **maquette Figma 19/08** — absent de la boutique |
| Titres | **Bebas Neue** | `type_heading_font` |
| Corps | **Cabin** | `type_body_font` |

> **Le wordmark n'est pas une police.** « Runes de Chêne » en tête d'écran est le
> **logotype** — un dessin de marque, posé comme image. Il ne se compose pas en Bebas Neue et
> n'a pas à s'y conformer. Confirmé par Uriel le 18/08 : la DA de l'interface reste
> **Bebas Neue + Cabin**, sans exception.

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

### Traitement visuel — trouvé en maquette le 18/08

**Deux cartes empilées sous un seul intertitre « L'appel », distinguées par la couleur du
fond** : crème pour la **mission photo**, rosé (rose poudré `#ebd2d2`) pour le **rendez-vous**.
On voit d'un coup d'œil lequel demande de photographier et lequel demande de marcher, sans
avoir à lire l'étiquette.

Chaque carte porte : le type, le titre, l'échéance en clair (« Jusqu'au 29 juillet 2026 »,
« 27 au 30 août 2026 »), des pastilles d'avatars empilées et le nombre de participants.

> Le spec disait « deux types du même objet » sans dire comment on les sépare à l'œil. La
> maquette a répondu mieux que le texte — c'est elle qui fait foi ici.

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

### ✅ La contrainte du portail est levée (19/08)

Un rendez-vous est le meilleur outil de recrutement de la marque, et une mission photo accepte
**déjà** les gens sans compte (`hub_photo_submissions.user_id` nullable, `consent_account_creation`
prévu). Tant que le Campement portait la discussion, le salon d'un appel était fermé aux
non-porteurs — et le nouveau venu qu'un rendez-vous avait fait marcher se cognait à une porte
close, une photo à la main.

**Le problème disparaît avec la révision du 19/08** : la discussion vit dans le **registre**
(§10), ouvert à tous, et le Campement ne garde que la décision (§9). Le salon d'un appel est
donc public par construction. Rien à inventer.

**Une initiative peut aussi lancer un rendez-vous** (§9) : même objet, deux origines — la
marque, ou un porteur.

### Ce qui n'est PAS un appel

Un appel **rassemble, il ne classe pas**. Pas de gagnant, pas de podium, pas de « meilleure
photo ». C'est un appel, pas un concours — sinon on réinstalle la compétition que la V2 retire.

## 7. Carte — VALIDÉ (structure)

Maquette de structure : artefact **« La Carte »**. Comme pour Le Seuil, ce n'est **pas une
référence graphique** — le fond de carte y est simulé et les teintes de pastille sont
indicatives ; la vérité vit dans `place_types.color`.

### Ce que la base sait déjà et que la carte ne dit pas

La pastille ne porte aujourd'hui qu'**une** dimension, le type. Chaque lieu en a cinq autres,
déjà remplies : **`era_id` / `year_exact`** (+ table `eras` avec bornes d'années),
**`best_season`**, **`accessibility`**, **`bivouac`**, **`sensible`**. La visite se valide à
**500 m** (`distance_gps_km = 0.5`).

### Une carte, trois lectures

La question tranchée n'était pas « comment afficher 3292 pastilles » mais **à quelle question
la Carte répond quand on l'ouvre**. Trois directions étaient possibles — un outil (« où je vais
aujourd'hui »), une mémoire (« où je suis allé »), un atlas du temps (« qu'est-ce qui s'est
passé ici »). **Elles ne s'excluent pas, mais une seule peut être le défaut, et c'est ce choix
qui décide de tout le reste.**

| Lecture | Ce que la carte dit | |
|---|---|---|
| **Aujourd'hui** | ce qui est atteignable, pastilles pleines par type | **par défaut** |
| **Mes pas** | le monde pâlit, tes visites restent allumées, le chemin se dessine | bascule |
| **Le temps** | la couleur dit l'époque, un curseur remonte les âges | bascule |

**Aujourd'hui par défaut** — pas parce que c'est la plus belle (c'est « Mes pas »), mais parce
qu'une carte qui s'ouvre sur une mémoire vide ou sur le néolithique **ne fait sortir personne**.
Elle fait marcher ; « Mes pas » récompense d'avoir marché ; « Le temps » donne envie de
comprendre. Dans cet ordre. Ce sont des **bascules du même écran**, jamais des écrans séparés.

### L'inconnu se tait

Le changement le plus important de la section, et il ne coûte qu'un changement de dessin.

Aujourd'hui un lieu non découvert est un **écu brun lourd avec un « ? »** — sombre, très
contrasté, et dix fois plus nombreux que les découvertes. L'œil voit donc d'abord **tout ce
qu'on n'a pas fait** : les trouvailles se noient, et la carte se lit comme une liste de cases à
cocher.

**Il devient une petite marque creuse à l'encre pâle du parchemin.** Toujours visible, toujours
cliquable — mais il invite au lieu de reprocher. Le découvert garde sa pastille pleine, colorée
par type (le même code que les badges de l'Accueil).

> **Ce que ça règle sans rien ajouter.** Si l'inconnu est pâle et le découvert coloré, la carte
> **s'allume à mesure qu'on marche** : la « carte-mémoire » devient gratuite, et « Mes pas » ne
> fait plus qu'accentuer un effet déjà présent par défaut. On récupère la direction la plus
> émouvante **sans payer son démarrage à froid**.

### Le compteur déménage

`797/3292 lieux découverts · 24 %` quitte l'écran d'ouverture pour **« Mes pas »**. Il reste de
la progression personnelle — donc conforme au principe — mais un pourcentage contre un total
fabrique du complétionnisme, et il n'a pas à être la première chose qu'on lit. *(Coquille à
corriger au passage : « lieux dcverts ».)*

### Le zoom est le seul réglage de portée

Un sélecteur de portée en trois crans (*autour de moi · une sortie · une journée*) a été
proposé puis **écarté par Uriel le 19/08** : redondant avec le zoom, et trop tôt pour savoir
s'il servirait. À revoir seulement si l'usage réel montre le besoin.

**Ce qui tient la densité, c'est donc le clustering — pas un filtre de distance.** C'est le
seul point non négociable de la section : sans lui, la carte redevient le tapis de pastilles
illisible d'aujourd'hui dès qu'on dézoome.

Les filtres restent, alimentés par des colonnes déjà remplies : **saison**, **accessibilité**,
**type**, **bivouac**.

### Ce qui tombe

Le bouton **Compagnies**. Les **écus « ? »** sous leur forme actuelle. Les **Titres restent**
(§1) : ils viennent avec le fragment et ne classent personne.

### À vérifier avant de s'engager

- **Combien de lieux sont réellement datés** (`era_id` / `year_exact`) — sinon « Le temps » est
  une coquille vide.
- Y afficher les **rendez-vous** en cours (§6), qui portent un lieu.

### Reste à concevoir

- **La fiche d'un lieu** et **la validation de visite à 500 m**.
- Le comportement quand la géolocalisation est refusée ou qu'on est loin de tout.

## 8. Codex — VALIDÉ (structure)

Maquette de structure : artefact **« Le Codex »**. Les emblèmes y sont indicatifs — les vraies
illustrations vivent dans les métaobjets `illustrations` côté Shopify.

**Le Codex est le registre de ce que tu as** — pas un catalogue de ce qui existe. Quatre
collections, et **un vrai pokédex** : ce que tu as en couleur, le reste en silhouette.

| Collection | Source | Traitement |
|---|---|---|
| **Fragments** achetés | `user_fragments` → `title_fragments` | **rangées** à trous |
| **Titres** | `title_fragments` | liste à trous |
| **Badges** d'événements | *n'existe pas encore* | onglet grisé, sans compteur |
| **Lieux** visités | `places` + visites | **synthèse + mur de macarons** |

### Des rangées, pas une grille — maquette du 19/08

**Un fragment porte une phrase**, pas seulement un nom : *« Ils étaient la première ligne, celle
sur laquelle reposait toute leur Cité. »* Une case de grille ne peut pas la contenir ; une
rangée oui — gravure à gauche, nom, la phrase, et l'action. Une grille à trois colonnes avait
été proposée puis **écartée par la maquette**.

L'action principale d'un fragment possédé est **« Lire ou écouter ce fragment »** : le lecteur
audio du 16/08 trouve ici sa place exacte. Celle d'un fragment non possédé est **« Découvrir la
collection »**.

**Ordre : ce que tu portes d'abord.** Sous un intertitre *« Ce que tu portes »*, puis *« Les
autres motifs »*. Tout s'affiche — c'est un vrai pokédex — mais **on ouvre sur sa collection,
pas sur son manque** : sans cet ordre, l'écran serait 55 rangées fanées et une seule en couleur,
et l'inconnu crierait plus fort que le connu (même défaut que la Carte avant révision, §7).

**Le sceau vert de validation est assumé hors palette** — arbitrage d'Uriel : c'est un code que
tout le monde lit sans apprentissage, et le sentiment de « validé » vaut l'écart.

### ⛔ Pas de ratio « x sur y »

Les compteurs d'onglet affichent **ce qu'on possède**, jamais un total : `FRAGMENTS 1`, pas
`1 / 56`.

> **La règle, et elle est plus fine que « le complétionnisme est permis » (§1).** Un ratio
> n'invite que s'il est **atteignable**. Personne n'achètera 56 motifs, ni ne visitera 3292
> lieux — alors « 1 / 56 » ne dit pas *« il y a une collection à remplir »*, il dit *« tu n'as
> presque rien »*. **Un ratio qu'on ne peut pas remplir décourage au lieu d'inviter.**
>
> Ça ne contredit pas le pokédex : les cases manquantes restent visibles et désirables, on
> retire seulement le **score** qui les compte.

> ⚠️ **Incohérence à trancher (§7).** La Carte affiche encore `797 / 3292 · 24 %` dans
> « Mes pas ». Si le ratio décourage ici, il décourage là aussi — et davantage, le total y étant
> encore plus hors de portée. **Soit les deux, soit aucun.**

### Fragment ≠ Titre

Le **fragment** est l'objet que tu portes ; le **titre** est ce qu'il te confère. Deux
collections, pas une. **Un seul titre est porté à la fois** — c'est celui que les autres voient.

> ⚠️ **Piège de nommage** : il n'existe **aucune table `fragments`**. Le catalogue, c'est
> **`title_fragments`** (nom, description, icône, `collection` = la Saga). Ne pas la confondre
> avec la liste des titres qu'elle sert aussi.

### Le trou a une taille limite

**Sur 14 fragments, montrer les trous est utile : ils sont achetables.** Sur 3292 lieux, 2495
trous seraient absurdes — et les non-visités vivent déjà sur la Carte. Donc **on inverse pour
les lieux** : pokédex à trous pour les objets, **mur de trophées** pour les lieux.

### La case voilée remplace le carrousel produits

Décision du 18/08 : le carrousel produits venait dans le Codex plutôt que sur l'Accueil.
**Il n'y en a finalement pas besoin** — la silhouette *est* le lien. Le contour dit que le
fragment existe, le pointillé qu'il n'est pas à toi, la mention **« En boutique »** qu'il est à
portée. C'est le moment de vente le plus contextuel possible : on ne coupe rien, on répond à
une envie déjà là. L'Accueil garde donc **un seul** bloc commercial (le bandeau Saga), et le
Codex n'en a aucun qui ressemble à une vitrine.

Un fragment possédé porte aussi **son fragment audio** — le lecteur mis en ligne le 16/08
retrouve ici une place naturelle.

### Les lieux : compter, puis montrer

**La synthèse** — combien par nature, par époque (`era_id`), par région. Elle produit des
phrases qui donnent envie de sortir : *« tu as visité 142 mégalithes, 31 abbayes et aucune
source — il y en a trois à moins de 20 km »*. « 797/3292 » ne dit rien de tel.

> ⚠️ Le compteur `797 / 3292 · 24 %` hérité de la V1 tombe sous la règle « pas de ratio »
> ci-dessus (§8). À trancher avec Uriel.

**Le mur de macarons** — un disque photo par lieu visité, **anneau à la couleur du type**,
pastille de type, le nom et **la date de visite**. Les plus récents d'abord.

> Effet non prévu : l'anneau coloré fait que **le mur redit la synthèse, mais à l'œil**. Les
> deux moitiés de l'onglet disent la même chose à deux grains.

### Les mêmes faits, trois grains

Trois écrans touchent « mes lieux visités ». La règle qui les sépare :

| | Ce qu'il en fait |
|---|---|
| **Le Compte** (§4) | il **compte** — une ligne de chiffres, rien de plus |
| **La Carte** (§7) | elle **situe** — où, dans le paysage |
| **Le Codex** (§8) | il **montre** — les objets et les preuves, en détail |

Aucun ne fait le travail d'un autre, aucun ne se répète.

### Gardé en réserve

- **`fragment_words`** — chaque fragment donne des mots rangés par fonction (`nom`, `épithète`,
  `connecteur`) avec leur genre. De quoi **composer** son propre titre au lieu d'en choisir un.
  Actif dormant, non retenu dans cette version.
- **`title_fragments.bonus_type` / `bonus_value`** — bonus de jeu V1. À neutraliser au portage,
  comme les bonus de faction (§1).

### À vérifier

- Combien de **titres** existent réellement.
- Combien de lieux sont **datés** (`era_id`) — la synthèse « par époque » en dépend, comme la
  lecture *Le temps* de la Carte (§7).

## 9. Campement — VALIDÉ (structure)

Maquette de structure : artefact **« Le Campement »**.

**Le Campement est la salle où les porteurs voient d'abord et tranchent ensuite.** Ce n'est
plus la discussion.

> **Pourquoi ce n'est plus la discussion — arbitrage d'Uriel, 19/08.** Une conversation
> **gagne** à s'ouvrir : plus il y a de monde, mieux c'est, pour la communauté comme pour la
> marque. La fermer derrière un achat détruit de la valeur pour fabriquer un privilège. Un
> **vote**, à l'inverse, ne vaut *que* parce qu'il est réservé — s'il est ouvert à tous, il ne
> pèse plus rien. La règle qui en sort : **on ouvre ce qui grandit, on réserve ce qui pèse.**

**L'avant-première et le vote sont le même geste.** On montre des motifs candidats que personne
dehors n'a vus ; **les voir** est le privilège, **choisir** est ce qu'on en fait.

### Les quatre sections

Elles ne sont jamais vides en même temps : un vote court, la première vit ; pas de vote, les
trois autres tiennent la pièce.

| Section | Contenu |
|---|---|
| **En délibération** | le vote en cours : candidats en avant-première, échéance, ta voix |
| **Ce qui arrive** | le tranché, pas encore public — et la **fenêtre d'achat réservée** |
| **Initiatives** | ce que la communauté propose et lance |
| **L'archive** | les décisions passées et **ce qu'elles ont produit** |

### Les règles du vote

- **Un choix entre des candidats, jamais une question ouverte.** Voter entre trois motifs *que
  la marque a dessinés* l'engage sur la décision sans l'exposer : quoi qu'il arrive, elle sort
  quelque chose qu'elle voulait faire. Une question ouverte est un chèque en blanc.
- **Un porteur, une voix.** Pas de poids proportionnel au nombre de fragments — ce serait un
  classement déguisé, exactement ce que la V2 retire.
- **Totaux publics, voix anonymes.**
- **Le score se découvre après avoir voté** — sinon les premières voix orientent les suivantes.
- **L'engagement est écrit dans l'écran du vote**, pas dans des conditions que personne ne lit.
  Exemple retenu : *« le motif en tête au 26 août part en production. Nous nous engageons sur le
  choix, pas sur la date. »*

> ⛔ **Le seul vrai danger.** Un vote qu'on n'honore pas fait plus de dégâts que pas de vote du
> tout. La question à trancher **avant** d'écrire du code n'est pas « comment on l'affiche »,
> c'est **sur quoi la marque accepte d'être liée**. Le prochain motif, probablement. La palette
> d'une Saga, peut-être. Une date de sortie, sûrement pas. **La liste doit être courte et
> honnête.**

### Les initiatives

**Deux natures, à ne pas confondre :**

| | Ce que ça engage |
|---|---|
| **Demande** (« un motif sur les lavoirs ») | engage la marque → **seuil + réponse obligatoires** |
| **Sortie** (« marche des mégalithes le 12 ») | n'engage rien → la marque **héberge**. Ce sont les **rendez-vous** du §6, lancés par un porteur. |

**Le seuil protège les deux côtés.** Une initiative qui atteint **N soutiens** reçoit une
réponse officielle — oui, non, ou plus tard, **avec la raison**. En dessous, elle s'éteint sans
rejet. La règle étant publique, *une idée qui n'a pas convaincu n'a pas été ignorée* : ce n'est
pas la même blessure. **Un refus motivé ne casse rien ; le silence, si.**

**Une initiative en cours à la fois, par personne.** Plutôt qu'un rang ou un score de mérite,
qui réinstallerait la comparaison. Chacun doit choisir sa meilleure idée. *Les plus motivés se
distinguent par ce qu'ils lancent, pas par un badge qui dit qu'ils sont motivés.*

### L'archive garde les refus

*« Écharpe en laine — demandée par 61 porteurs, refusée : pas d'atelier trouvé. »* Une salle qui
n'affiche que ses succès ne prouve rien. **Le refus motivé est ce qui rend les oui crédibles**,
et c'est l'archive qui prouve que le vote comptait.

### La porte

Elle dit **ce qui se passe derrière, sans le donner** : le sujet du vote et le nombre de voix,
**jamais les motifs**. Une porte fermée qu'on voit à travers est une invitation ; opaque, c'est
un refus.

Le portail existe déjà : `purchase_log` → `user_fragments` détermine qui est porteur (§4). Rien
à construire pour la serrure.

### Ce que le porteur gagne ailleurs

Le Campement n'est pas le seul privilège. **Sur la Carte**, un contributeur peut restreindre la
visibilité d'un lieu rare ou fragile — voir §9bis ci-dessous. Être porteur, c'est aussi **voir
la carte que les autres ne voient pas**.

### À vérifier

- `territory_name_proposals` / `territory_name_votes` (gelées en mig 274) : mécanique de vote
  déjà écrite, peut-être réutilisable.

## 9bis. Filtre de visibilité des lieux (Carte)

**Les lieux sont ajoutés par les gens** (`places.author_id`). Un lieu rare ou fragile doit
pouvoir être protégé — c'est ce que font les bases naturalistes et le géocaching depuis
toujours. **C'est le contributeur qui choisit à qui il l'ouvre.**

| Niveau | Qui voit |
|---|---|
| **Ouvert** | tout le monde |
| **Discret** | tout le monde voit qu'il existe, **position floutée** ; les porteurs voient les coordonnées exactes |
| **Réservé** | seuls les porteurs |
| **Personnel** | personne d'autre que l'auteur |

**« Discret » est le niveau le plus utile** : le lieu reste dans sa zone, la carte reste dense
et vivante pour tout le monde, et la station reste protégée.

- **Le défaut doit être « Ouvert ».** Une restriction proposée par défaut referme tout par
  prudence et tue la carte. La restriction est un **geste délibéré**.
- **Le contributeur peut en changer** — un lieu devient fragile après un passage dans la presse,
  ou cesse de l'être.
- **Le floutage se fait côté serveur, dans la RPC.** Si les coordonnées exactes partent au
  client pour être arrondies à l'affichage, la protection ne vaut rien.
- Points d'accroche existants : **`sensible`** porte déjà cette intention, **`private`** couvre
  le niveau Personnel. **Ne pas toucher à `masked`** : c'est de la modération (« retrait
  réversible de l'app ») — mélanger *caché parce que douteux* et *protégé parce que précieux*
  rendrait les deux illisibles.

## 10. Le registre — la discussion, partout

**Un chat de MMO, pas une messagerie.** Décision d'Uriel le 19/08, après mesure : **10-15
personnes en simultané**. À cette densité un chat vit — un message reçoit sa réponse pendant que
son auteur est encore là.

**Ce n'est pas un onglet, c'est un tiroir** ouvrable depuis n'importe quel écran : on discute en
regardant la Carte. **Ouvert à tous**, porteurs ou non — c'est ce qui grandit.

### Le registre

Une seule colonne **dense** — douze à vingt lignes d'un coup d'œil. Canaux en préfixe coloré,
noms cliquables, lignes système en italique.

| Canal | Teinte | |
|---|---|---|
| **Feu** | brun `#594848` | le salon global |
| **Atelier** | kaki `#46493c` | bugs et idées |
| **Système** | pâle `#a3927a` | arrivées, appels — en italique |

**La densité est la fonctionnalité.** C'est elle qui rend inutiles les fils et les citations :
une réponse reste à portée de vue de sa question. *Un fil fragmente le regard et crée un second
endroit où personne ne va — mécanique de grosse communauté, nuisible à douze.* Écartés tous les
deux.

**Le lien d'objet** — un lieu, un fragment, un appel se lient dans la phrase :
`[Menhir de Kerloas]`, en couleur de son type. Toucher déplie l'objet sur place. Exactement le
geste de lier un objet dans un chat de MMO, et c'est ce qui distingue le registre d'un Discord.

**Le nom est un bouton** : murmurer, voir son Codex, inviter dans un groupe, saluer. *C'est de
là que naissent les groupes*, pas d'un écran de création.

**Le titre porté, en chevrons** — `Luna ‹Demiurge›`. Convention MMO, et **la seule raison d'avoir
un titre** : un titre que personne ne voit ne sert à rien. Il remplace la couleur de Maison V1.

### Les murmures sont à part

**Une vraie boîte, pas un filtre** — décision d'Uriel : un murmure se perdrait dans le flux
entre deux connexions. Les **groupes** sont du même côté : un groupe est une conversation
fermée. Frontière : **le registre est public, les murmures sont privés.**

Une **ligne de passerelle** dans le registre signale l'arrivée d'un murmure (« Luna te
murmure ») sans jamais en montrer le contenu.

### Trois constats de base

1. **Purge à 14 jours.** `cleanup_old_chat_messages()` supprime tout message de plus de deux
   semaines — cohérent pour un registre public, qui se consume. **Mais la purge doit devenir
   sélective** : elle épargne les murmures (perdre sa correspondance privée à J+14 est brutal).
   *Reste à trancher* : épargne-t-elle aussi les messages publics qui **lient un objet**, qui
   sont justement les « partages » qu'on veut garder ?
2. ⛔ **`anon` a `GRANT ALL` sur `chat_messages`.** Les policies RLS rattrapent aujourd'hui
   (`auth.role() = 'authenticated'`), ce qui suffit pour un salon public où tout le monde a le
   droit de tout lire. **Ça ne suffit plus pour des murmures**, où la règle devient « seuls les
   deux intéressés ». Ce repo s'est déjà fait avoir deux fois par ce motif — `purchase_log` et
   le SELECT d'`anon` sur `users` (§ voir `docs/db/gotchas.md`). Retirer le GRANT, et **gater
   par appartenance à la conversation, pas par le nom du canal**.
3. `faction_id`, `faction_color`, `faction_pattern` traînent sur chaque message — le chat
   colorait les noms par Maison. À neutraliser au portage ; **le titre en chevrons prend leur
   place**.

## Points ouverts

- Ordre de construction retenu par Uriel : **Compte client → Accueil → Carte**, puis
  Codex et Campement.
- Uriel réalise les maquettes dans **Figma** à partir de ces sections ; la DA se fixe là.
- « Félicité par ses pairs » a besoin de pairs. Sur un Campement peu peuplé, poster sans
  recevoir de salut se vit plus mal qu'une absence de fonctionnalité. À traiter en
  concevant le Campement.
- Chemin de bascule V1 → V2 pour les joueurs existants : chantier séparé, non commencé.
