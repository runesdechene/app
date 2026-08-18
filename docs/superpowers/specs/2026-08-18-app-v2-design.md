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
| 2 | **Le plus salué** | Le contenu ayant reçu le plus de saluts ces derniers jours — récit, trouvaille, photo de porteur. Carte à vignette + compteur de saluts + auteur. |
| 3 | **Bandeau Saga** | Le seul bloc ouvertement commercial. Une collection Saga : nom, « N motifs · N pièces », un lien vers la boutique. |
| 4 | **Sur les chemins** | Le flux d'activité. Lignes brèves : pastille de type, phrase, méta, bouton **Saluer**. |
| 5 | **Nouveaux sur la carte** | Carrousel horizontal des lieux fraîchement ajoutés, **avec leur distance**. Seul bloc qui pousse dehors — il finit le scroll sur une envie de marcher. |

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

Sans lieu visité, les blocs 2-3-4 seraient des listes d'inconnus. Alors :

- le seuil **grandit**, pastille « Bienvenue », ton d'accueil
  (*« Ici, on ne gagne rien contre personne. On marche, on trouve, on garde trace. »*) ;
- une **invitation concrète** prend la place des blocs communautaires : combien de lieux
  attendent, à quelle distance est le plus proche, puis « Ouvrir la Carte » ;
- l'onglet **Campement apparaît cadenassé mais visible** — on voit qu'il existe, c'est ce
  qui donne envie d'y entrer. Le tap mène à la marche à suivre, jamais à une porte close.

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

- **Longueur du scroll** : ~2,5 hauteurs de téléphone. Le carrousel (bloc 5) est tout en
  bas, donc rarement vu — alors que c'est le seul bloc qui pousse dehors.
- **Blocs « Le plus salué » et « Sur les chemins »** montraient tous deux la communauté et
  risquaient de se confondre. Le bandeau Saga, inséré entre les deux, les sépare — bon effet
  de bord non prévu. À revérifier en maquette.
- **Bandeau « RUNES DE CHÊNE »** en haut : mange une ligne sur chaque écran. Alternative :
  avatar seul.
- **Densité du flux** : curseur entre « on voit la vie » et « on lit bien ».

## 6. Carte

*(à concevoir)*

## 7. Codex

*(à concevoir)*

## 8. Campement

*(à concevoir)*

## Points ouverts

- Ordre de construction retenu par Uriel : **Compte client → Accueil → Carte**, puis
  Codex et Campement.
- Uriel réalise les maquettes dans **Figma** à partir de ces sections ; la DA se fixe là.
- « Félicité par ses pairs » a besoin de pairs. Sur un Campement peu peuplé, poster sans
  recevoir de salut se vit plus mal qu'une absence de fonctionnalité. À traiter en
  concevant le Campement.
- Chemin de bascule V1 → V2 pour les joueurs existants : chantier séparé, non commencé.
