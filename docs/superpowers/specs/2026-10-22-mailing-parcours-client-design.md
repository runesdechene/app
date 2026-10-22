# Mailing et parcours client — conception

> 22/10/2026 · Hub (`apps/hub-v2`), Supabase, Resend · maquettes Figma validées par Uriel le 22/10
> (fichier App v2, page « Hub Emails ») · état du projet : vault, `1. LE MÉTIER/1. Runes de Chêne/Parcours client/_État.md`.
>
> E-mails : lettre de bienvenue `733:2557` · Fragment (Hécate) `743:2464` · Carnet de route `745:2464` ·
> Missive de nouvelles `748:2521`. Questionnaire public : `750:2520` · merci `750:2669`.
> Hub : Écrire dans le modèle `753:2529` · brique Choix ouverte `756:2592` · Listes `713:2091` ·
> Automatisations `713:2376` · Réponses `714:2201` · fiche d'un compte `714:2473` · Qui sont-ils ? `747:2463`.
> Les écrans 712:2026 (Écrire, première version) et les sections « v2 Encre & Vélin », « Un e-mail hors
> marque » et l'ancien « Mailing — les e-mails » sont des étapes écartées : ils ne font pas foi.

## Pourquoi

Les e-mails marketing passent aujourd'hui par Shopify Email : sections pénibles à composer, design
difficile à tenir, on s'y perd. Uriel veut écrire et envoyer depuis le Hub, par Resend, des lettres
belles et reconnaissables, et un parcours client qui mène chaque inscrit, quelle que soit sa porte,
jusqu'au premier puis au deuxième achat. Il veut aussi **connaître** sa clientèle.

**Réussi si** : Uriel écrit une Missive en dix minutes sans toucher au design ; chaque nouvel inscrit
reçoit seul sa bienvenue ; les réponses arrivent dans le Hub ; « Qui sont-ils ? » dit d'où viennent les
gens et ce qu'ils aiment ; les e-mails marketing de Shopify peuvent être coupés.

**Hors du projet** : les e-mails de commande (confirmation, expédition) restent chez Shopify ; pas de
SMS, pas de test A/B, pas de page Prospects (plus tard) ; le Campement n'est pas concerné.

## Le parcours (une personne = une fiche)

Toutes les portes écrivent déjà dans `users`, reconnus par l'e-mail et reliés au client Shopify :
stand (`stand-create-account`), flyer (`flyer-create-account`), achat (`shopify-order-webhook`), appli,
synchro des clients (`shopify-sync`). Il manque une porte : **l'inscription à la newsletter du site**,
qui reste dans Shopify tant que la personne n'achète pas.

| Moment | Ce qui part |
|---|---|
| Inscription newsletter, flyer ou appli, sans achat | **Bienvenue** : la lettre d'Uriel (J0), puis la suite de découverte |
| Compte créé au stand | **Bienvenue du stand** : merci, ses Fragments, l'appli, le Campement |
| Premier achat en ligne | **Après le premier achat** : la série existante, réécrite pour la V2 |
| Achat pendant une suite | La suite de découverte s'arrête, « Après le premier achat » prend le relais |
| Le jour de son anniversaire | **Anniversaire** : un mot et un petit cadeau |

Les jours de la suite Bienvenue (0, 3, 7, 11, 14 dans la maquette) sont une proposition, réglables
dans le Hub. Le texte des suites autres que la lettre de bienvenue est à écrire avec Uriel.

**Le cadeau de bienvenue** est un pin de la Rune, offert avec la première commande (et au stand) :
promis dans le P.S. de la lettre, avec une date limite. Pas de code de réduction.

**Décidé avec Uriel après relecture (22/10)** :
- Les suites ne concernent que les personnes inscrites **à partir du jour de leur mise en route** ; les
  contacts existants n'entrent dans aucune suite (une fiche créée par `shopify-sync` avec une vieille
  date n'est pas une nouvelle inscription). Ils reçoivent une première Missive écrite à la main.
- L'accord marketing de Shopify est **repris tel quel**, puis tenu synchronisé dans les deux sens :
  **la dernière action gagne** (désabonnement dans le Hub → Shopify coupé ; réabonnement sur le site →
  accord rétabli dans le Hub).
- La série Shopify « après le premier achat » est **coupée dans Shopify le jour même** où la suite du
  Hub passe en prod. Son contenu (quatre e-mails) est en captures dans la conversation du 22/10 : la
  version du Hub la réécrit pour la V2.

**Choix du concepteur (à relire)** :
- Tout achat, en ligne ou au stand, arrête la suite de découverte ; un compte créé au stand lance la
  Bienvenue du stand à la place de la Bienvenue.
- `send-email` reste pour les e-mails de service de l'appli (`contribution_approved`,
  `crowns_awarded`, `content_retry`) ; seul `fin_de_coupe` disparaît à la purge.

## Les e-mails

Un seul système, quatre modèles (Missive de nouvelles, Fragment, Carnet de route, lettre de
bienvenue), puis d'autres. La structure de chaque modèle est figée ; seul le contenu de zones prévues
change. Polices : Bebas Neue (grands titres), Alegreya (texte), Cabin Condensed (rubriques). Pas
d'italique, pas d'encart arrondi, pas de bouton-pilule : les appels sont des liens soulignés ou de
grandes lettres soulignées. Photos pleine largeur, légèrement penchées, légendées.

**Trois couleurs fondamentales** par envoi : **fond** (toute la page), **titres** (grand titre,
chiffres, liens), **rupture** (bande pleine largeur, lettrine). Le texte courant et les rubriques s'en
déduisent (crème sur fond sombre, encre sur fond clair ; rubriques en nuance des titres). Palettes
toutes faites : la marque (brun `#3f3024`, or `#c49a5a`, rouge sceau `#a94842`), les quatre saisons,
et **un Fragment** : chaque Fragment porte trois teintes réglées dans le Hub (Hécate : nuit, lune,
pourpre). Le Hub refuse d'envoyer si le contraste du texte devient illisible (seuil WCAG AA).

Chaque e-mail a un **objet** et une **ligne d'aperçu** ; l'expéditeur affiché est « Uriel · Runes de
Chêne ». Pied de page : adresse légale et désabonnement en un clic.

Les e-mails ne montrent que la marque (Fragments, porté, atelier, stand), jamais les photos de lieux
de l'appli (`.claude/rules/interface.md`).

## Dans le Hub : un groupe « Missives »

Au menu, entre « Fragments et boutique » et « Parler aux joueurs » : Écrire · Envois · Listes ·
Qui sont-ils ? · Automatisations · Réponses (pastille des non lus). Écrans aux briques du Hub
(`shared/ui`), comparés à la maquette à 1440 et 390 px.

- **Écrire** : à gauche les réglages (le modèle via la brique **Choix**, les palettes et les trois
  couleurs, à qui, l'objet, quand ; « Programmer pour N personnes », « M'envoyer un essai ») ; au
  centre **l'e-mail entier, éditable sur place** : chaque zone se touche et s'écrit (titre, photo à
  remplacer, recadrer, pencher ; ouverture avec lettrine automatique ; nouvelles qu'on ajoute,
  déplace, supprime ; rupture). L'éditeur s'adapte au modèle (le Fragment propose ses pièces et
  prix, le Carnet ses haltes). Les pointillés d'édition n'apparaissent jamais dans l'envoi.
- **Choix** : nouvelle brique `shared/ui` — fermée, la vignette du modèle à ses couleurs et son nom ;
  ouverte, une recherche, des groupes (Lettres, Fragments, Automatiques), une vignette par modèle et
  son usage. Elle servira ailleurs.
- **Envois** : l'historique (pas de maquette : liste au style de « Comptes », objet, liste, date,
  ouverts, clics, réponses).
- **Listes** : Tout le monde · Prospects (aucun Fragment) · Porteurs (≥ 1 Fragment) · Meilleurs
  clients (≥ 5 Fragments) — toutes déduites de la fiche — et Ambassadeurs et égéries, choisis à la
  main. Seuls ceux qui ont accepté les nouvelles reçoivent un envoi manuel.
- **Automatisations** : chaque suite, ses e-mails jour par jour, active ou en pause, ses chiffres.
- **Réponses** : la boîte des réponses aux e-mails, le fil, répondre depuis le Hub ; chaque réponse
  rejoint la fiche de la personne.
- **Qui sont-ils ?** : la répartition des réponses au questionnaire, filtrable Prospects / Porteurs,
  les dernières attentes en texte libre, les anniversaires du mois.
- **La fiche d'un compte** gagne « Ses missives » : accord et date, listes, époque, anniversaire,
  suite en cours, dernière réponse ; « + Ajouter aux Ambassadeurs et égéries ».

## Le questionnaire « Dis-nous qui tu es »

Page publique du Hub, au design de `/flyer` et `/flyercadeau` (briques `Public/Champ`, `Public/Case`,
`Public/Bouton`), jamais celui des e-mails. Sept questions : l'époque (deux au plus), comment il a
découvert la marque, ce qui l'amène, ce qui lui plaît (plusieurs), ce qu'il attend (libre), son
département, son anniversaire (jour et mois, facultatif). Bouton « Envoyer mes réponses » ; écran
« C'est noté » qui rappelle le pin.

La lettre de bienvenue y mène : chaque époque de sa bande rouge est un lien personnel qui ouvre la
page avec l'époque déjà cochée. **Rien ne s'enregistre au simple clic** (les messageries d'entreprise
cliquent seules sur les liens) : tout s'enregistre à l'envoi du questionnaire. Le lien est signé et
propre à la personne. Sans lien (au stand, depuis le site), la page demande l'e-mail et **n'écrit
rien** avant que la personne ait suivi le lien de confirmation envoyé à cette adresse (choix du
concepteur) : personne ne remplit la fiche d'un autre. Dans l'appli, la personne est connectée.

L'anniversaire se demande aussi à la création du compte au stand et dans l'appli, facultatif.

## Les règles qui ne se discutent pas

- **Accord** : un envoi manuel et les suites de découverte ne partent qu'aux personnes qui ont accepté
  les nouvelles (L34-5 CPCE), avec la date et la porte de l'accord. L'appli doit gagner une case
  « recevoir les nouvelles » à l'inscription (aujourd'hui elle ne la demande pas). La bienvenue du
  stand et l'après-achat s'adressent à des clients (exception client du L34-5), toujours avec un
  désabonnement.
- **Désabonnement en un clic** : lien signé dans chaque e-mail et en-têtes `List-Unsubscribe` et
  `List-Unsubscribe-Post` (exigés par Gmail et Yahoo pour les envois en nombre). Un désabonnement
  coupe aussi l'accord côté Shopify.
- **Un sous-domaine dédié, `missives.runesdechene.com`** (validé par Uriel le 22/10), pour l'envoi **et** la
  réception des réponses, authentifié chez Resend (SPF, DKIM, DMARC) avant le premier envoi groupé.
  Le domaine principal n'est pas touché : sa boîte est chez Proton (MX `mail.protonmail.ch`), Shopify
  y envoie. Les DNS sont chez **o2switch** (`ns1.o2switch.net`, vérifié le 22/10).
- Un rebond dur ou une plainte retire l'adresse des envois (webhooks Resend).
- Les échecs laissent une trace exploitable (backlog « échecs muets ») : chaque envoi a un statut.

## Ce qui reste à construire (repères pour le plan)

- **L'accord marketing chez nous** : colonnes sur `users` (accord, date, porte), alimentées par les
  portes existantes, par `shopify-sync` (qui doit lire `email_marketing_consent`) et par un **nouveau
  webhook Shopify** clients créés et accord modifié (la porte newsletter du site).
- **Les modèles en code** : React Email (de l'équipe Resend), un composant par modèle ; le contenu
  d'un envoi est un JSON de zones ; le rendu HTML se fait côté serveur, et l'éditeur du Hub affiche le
  même composant.
- **L'envoi** : une fonction serveur appelée par `pg_cron` (comme `enigme_du_jour`) traite les envois
  programmés et les étapes de suites dues, par lots (envoi groupé de Resend). `send-email` et ses
  types V1 (`fin_de_coupe`…) partent à la purge.
- **Les tables** (noms indicatifs ; schéma **vérifié sur la base live** avant toute migration, règle
  du dépôt) : missives et leurs envois par personne, suites et inscriptions aux suites, réponses,
  questionnaire, ambassadeurs, trois teintes sur les Fragments, anniversaire.
- **Les réponses** : réception des e-mails entrants (adresse de réponse dédiée) vers le Hub.

**Laissé au constructeur** : la découpe exacte des tables, le rythme du `pg_cron`, la façon de
pencher les photos à l'envoi (image préparée à l'import : les messageries ne savent pas pivoter une
image), la mise en page d'« Envois ».

## Ordre de construction

1. **Fondation** : accord et portes (dont le webhook client Shopify et la case de l'appli),
   désabonnement, domaine Resend, modèles en React Email, Écrire (édition sur place, brique Choix,
   trois couleurs), Listes, envoi programmé, Envois. → Uriel envoie sa première Missive.
2. **Suites** : Bienvenue (la lettre validée), Bienvenue du stand, Après le premier achat, arrêt à
   l'achat, Automatisations.
3. **Connaître** : le questionnaire, « Qui sont-ils ? », « Ses missives » sur la fiche.
4. **Réponses** dans le Hub.
5. **Anniversaire** et teintes par Fragment.

Chaque lot passe en prod et se teste (essai à soi-même dans Gmail, Outlook, Apple Mail, sur
téléphone) avant le suivant.

## Points ouverts

- **Les grands titres en Bebas** : Gmail n'affiche pas les polices web. Les envoyer en image (fidèle
  partout, mais non sélectionnable et plus lourd) ou accepter une police de repli. À trancher par
  Uriel sur un essai réel.
- **Les teintes d'un Fragment** : qui les règle (Uriel dans la fiche Fragment du Hub) et pour quels
  Fragments au lancement.
- **Le pin** : à produire avant d'envoyer la lettre de bienvenue, qui le promet ; sa date limite.
- **Le petit cadeau d'anniversaire** (lot 5) : sa forme, et s'il faut un mécanisme côté Shopify.
- **Le volume réel de contacts** à vérifier avant le lot 1 (plafonds d'envoi de l'offre Resend).
- Le brouillon `docs/db/drafts/systeme-emails-BROUILLON.sql` est antérieur : il ne fait pas foi.
