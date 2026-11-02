# Le Codex — conception (02/11/2026)

> Validé avec Uriel le 02/11/2026. Maquettes Figma (fichier `MKqyVhDPreg06PMEAaDxde`) :
> « Codex V1 — F » (la page), « C » (un Fragment scanné), « D » (un Fragment porté),
> « Scan — un nouveau Fragment sort de l'ombre (animation) », « G » (la barre d'onglets),
> composants « Codex V1 / Fragment » et « Codex V1 / Rareté ».
> **Échéance : tout en ligne le jeudi 05/11** (Uriel, 02/11), la veille du dépliant. Ordre de
> livraison, pour que l'essentiel tombe d'abord : (1) onglet, page, fiches, scans au Codex, numéro
> de Porteur ; (2) anecdotes et « Creuser encore » ; (3) animation de découverte ; (4) saisie au Hub
> écrite dans Shopify, fiche produit de la boutique.

## L'intention

Le Codex est le Pokédex de Runes de Chêne : tout ce qu'on collectionne, et pour l'instant seulement
les Fragments. On doit avoir envie de compléter sa collection et de scanner le t-shirt des autres,
parce que chaque scan apprend quelque chose sur le motif. Le scan attire ; l'achat ouvre tout.

**Anti-buts** : un péage à l'entrée (le premier scan ne coûte jamais rien) ; une rareté inventée
sur un motif ; une même information saisie à deux endroits ; un écran qui réinvente une brique qui
existe déjà.

## Trois états par Fragment

| État | Ce qu'on voit | Ce qui s'ouvre |
|---|---|---|
| Inconnu (ni scanné, ni porté) | silhouette presque effacée, un « ? » | rien |
| Scanné | le motif net, sans couleur, le nombre de scans | préhistoire, mot de l'artiste, ses anecdotes trouvées ; les cadeaux sous cadenas, « Acquérir ce Fragment » |
| Porté (`user_fragments`) | la carte dorée du profil, le check à la couleur de la collection | tout : l'histoire entière à lire et à écouter, le skin, le titre du motif, le numéro de Porteur |

Une marque « Nouveau » (motif de moins de 60 jours) et une marque d'édition vraie (« Édition
limitée », « Retiré », « Exclusif … ») se posent sur la carte, quel que soit l'état.

## La page du Codex (maquette F)

- **Onglet de la barre** : Explore · Carte · Codex · Campement · Compte. Messages passe en icône dans
  l'en-tête (bulle au trait, pastille des non-lus) ; la cloche passe au même trait. Icônes d'Uriel
  (`Codex 2.svg`, `campement.svg`, `Carte.svg`) en pochoirs de la barre. Sur PC, le Codex s'ouvre
  dans le panneau de gauche, même mise en page.
- **Ouvert à tous**, compte requis pour collectionner : un scan sans compte montre la carte et la
  préhistoire, puis invite à créer un compte pour la garder.
- **En haut** : « 6 / 10 Fragments portés », « 2 scannés · 2 inconnus », une fine barre continue en
  trois parts (portés, scannés, reste). Jamais de crans : il y aura plus de 50 Fragments.
- **Filtres** : « Toutes », puis une gélule par collection (son icône, son compte) ; la bande défile
  et s'efface en fondu à droite.
- **Une section par collection** (`fragments.heritage`) : panneau teinté à sa couleur, son icône, sa
  barre, son titre à gagner ; repliable ; dépliée si elle est en cours, repliée si l'on n'y a rien.
  Grille de cartes qui s'adapte à la largeur (3 par ligne sur téléphone).
- **Titre de collection** : porter tous les Fragments d'une collection donne son titre.
  *Ouvert* : ce que devient le titre quand un nouveau motif rejoint la collection (le garder et
  monter en grade, ou le perdre). Ne bloque pas la V1.

## La fiche d'un Fragment (maquettes C et D)

Une seule fiche, dont les blocs s'ouvrent selon l'état :

1. L'illustration, le nom, « de la collection … », « Dessiné par … », le statut (« Scanné 5 fois »,
   ou la gélule « Porteur n° 37 » à la couleur de son rang).
2. **En bref** — la préhistoire, pour tous. Au Porteur : « Lire toute son histoire, ou l'écouter → ».
   Aux autres : « La suite, en entier et racontée, est réservée à ceux qui le portent. »
3. **Le mot de l'artiste** — pour tous ; avatar et signature ; 4 lignes puis « Lire la suite ».
4. **Le Porteur** : ses cadeaux (son histoire → la page du Récit qui a déjà le lecteur audio ; le
   skin, « Équiper » ; le titre, « Porter » ; le numéro de Porteur).
   **Les autres** : « En le portant, tu gagnes » sous cadenas, puis « Acquérir ce Fragment » (la
   boutique) et « Déjà Porteur ? Ton e-mail de commande suffit… ».
5. **Ses anecdotes** : celles trouvées, chacune avec son insigne de rareté ; combien il en reste ;
   le bouton « Scanner ce motif » (ouvre le scanner).

## Le scan d'un Fragment

- **Les anecdotes se gagnent en scannant, Porteur compris** (Uriel, 02/11) : il peut scanner son
  propre t-shirt.
- **Une anecdote gratuite par motif et par jour.** Chaque anecdote de plus, sur place : « Creuser
  encore » pour **2 énergies**, tant que la jauge le permet ; grisé, « Plus assez d'énergie », sinon.
  Ce bouton n'existe qu'après un scan, jamais sur la fiche ouverte depuis le Codex.
- **Un motif jamais scanné** : l'animation de découverte (3,4 s) — la carte sort de l'ombre de dos
  (la rune Runes de Chêne en or), se retourne dans un halo, un reflet holographique la balaie,
  « NOUVEAU FRAGMENT ! », « 2 sur 5 de La Garde d'Acier » (le compte dans la collection, jamais le
  total), la première anecdote et son insigne, « Creuser encore », « Voir dans le Codex → ».
  `prefers-reduced-motion` : la carte apparaît révélée, sans mouvement.
- Un motif déjà connu : la fiche, et la nouvelle anecdote du jour s'il y en a une.
- L'acheteur au stand : la caisse relie le Fragment au compte au moment de l'achat ; il le trouve
  porté dès son premier scan.

## Les raretés — un seul jeu de trois insignes

Commune (sceau d'encre), Peu commune (losange vert-de-gris), Rare (étoile d'or). Ils servent à :
- **la rareté d'une anecdote** ;
- **le rang du numéro de Porteur** : n° 1-10 Rare, 11-50 Peu commune, 51+ Commune (seuils fixes : un
  numéro ne change jamais de rang).
La marque d'édition d'un motif n'est pas une rareté ; elle porte la petite étoile d'or et son mot.

## Les données : une seule source par information

**Règle** : ce que la boutique peut montrer vit dans Shopify (la synchro du Hub le recopie) ; ce
que seule l'appli utilise vit en base ; ce qui se calcule n'est pas stocké.

| Information | Source | Aujourd'hui |
|---|---|---|
| Nom, illustration, histoire (`son_histoire`), audio, collection (`collection_d_heritage`) | métaobjet Illustration | lus par la synchro (`lireIllustrations`) |
| Préhistoire « En bref » | métaobjet, `resume` | lu par la synchro ; à vérifier rempli partout |
| Artiste : nom **et photo** | métaobjet Artiste (référencé par `artiste`) | seul le nom est lu → ajouter la photo |
| Mot de l'artiste | métaobjet Illustration (un mot par motif) | **à créer** dans Shopify, puis lu |
| Marque d'édition | métaobjet Illustration | **à créer** (liste : limitée, retiré, exclusif + précision) |
| Icône, couleur et titre d'une collection | table `codex_collections`, réglée dans le Hub | **à créer** (la boutique ne les montre pas : pas de métadonnée Shopify connue) |
| Qui porte quoi | `user_fragments` (caisse, Hub) | existe |
| Les scans | `scans` (mig 474) | existe ; à lier au compte pour le compteur |
| Anecdotes (texte, rareté, motif) | base, rédigées dans le Hub comme les énigmes | **à créer** |
| Anecdotes trouvées par chacun | base | **à créer** |
| Énergie | `users.energy_points`, `_energie_max` | existe ; ajouter la dépense « creuser » (2) |
| Numéro de Porteur, « Nouveau » (`title_fragments.created_at` < 60 j), progression, titre de collection | calculés | — |

**On écrit dans le Hub, ça vit dans Shopify** (Uriel, 02/11) : la fiche d'un Fragment, au Hub, sert
à saisir la préhistoire, le mot de l'artiste et la marque d'édition ; le Hub les écrit dans le
métaobjet Shopify (comme il y pousse déjà avis et photos), la synchro les ramène dans l'appli. Un
seul endroit pour écrire, un seul où l'information vit ; la boutique les rend dans sa page (SEO).

La fiche produit de la boutique (thème, `sections/rdc_motif.liquid`) montrera « En bref » et « Le
mot de l'artiste » à la place de l'histoire contée : mêmes champs Shopify, lus des deux côtés.
Dans ce chantier.

## Briques réutilisées, rien de réinventé

- La carte d'un Fragment porté **est** celle du profil (`ProfilFragments`) : un seul composant de
  carte, avec ses états, pour le profil et le Codex.
- Le Récit (`RecitFragment`, `LecteurAudio`) pour l'histoire entière ; « Lire la suite » suit son
  « Lire tout le récit ».
- La jauge et les règles d'énergie (`features/energie`) ; `Feuille`, `Button` (bouton clair : contour
  sable et ombre chaude, règle `interface.md`) ; la barre d'onglets (`tabs.ts`, `TabBar`).
- Le scanner (`/scan`, mig 474) ; le skin = le signe du profil (`useChoisirSigne`).

## Choix de construction (tranchés par Claude, à relire)

- **Numéro de Porteur figé** : une colonne posée une fois, au moment où le Fragment est relié au
  compte (`user_fragments`), jamais recalculée. Un remboursement ou un compte supprimé ne décale
  personne. *Remplace « calculé » dans le tableau des données.*
- **Tirage d'une anecdote** : au hasard parmi celles pas encore trouvées, pondéré par la rareté
  (commune 60 %, peu commune 30 %, rare 10 %, réglable). Toutes trouvées : « Tu connais toutes ses
  anecdotes », et « Creuser encore » disparaît.
- **« Scanné N fois »** compte mes scans de ce motif (`scans.user_id`, qui existe), un par scan
  reconnu ; un même motif rescanné dans la minute ne compte qu'une fois.
- **Sans compte** : le scan montre la carte, la préhistoire et l'anecdote, mais rien n'est gardé ;
  l'invitation dit « Crée ton compte pour commencer ta collection ». Pas de reprise des scans
  d'avant l'inscription en V1.
- **Un bloc dont le champ Shopify est vide ne s'affiche pas** (mot de l'artiste, édition, photo).
- **Triche** : le serveur décide de tout (anecdote gratuite une fois par motif et par jour, 2
  énergies par anecdote de plus) ; un faux scan ne rapporte donc qu'une anecdote par jour et par
  motif. Accepté en V1.
- **L'onglet Compagnies** reste masqué (01/11) et part avec le retrait des Compagnies ; l'onglet
  Campement mène à sa première page.

## Hors V1

Le Campement (sa première page a sa propre maquette), les croquis de l'artiste, le code débloqué
par un scan, l'animation d'une collection complète, le Codex vide (première ouverture : à
maquetter), les autres objets à collectionner.
