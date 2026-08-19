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
