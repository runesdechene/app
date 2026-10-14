# Le Hub V2 — chantier A : le nouveau Hub, avec tout ce qui existe

> Conception validée par Uriel le 14/10/2026 (brainstorm du 12/10 repris le 14/10).
> Maquettes : Figma « Runes de Chêne — App v2 », section **Hub V2 — maquette (14/10)** (nœud 578:614).
> État et décisions : vault, `1. LE MÉTIER/1. Runes de Chêne/Explore/_État.md`.

## 1. Ce qu'est le Hub

**La zone de pilotage de l'activité Runes de Chêne et de sa communauté, hors commerce poussé
(Shopify).** (Uriel, 14/10.) Chaque écran répond à « comment va la communauté, et qu'est-ce qui
attend une action ? ». Un écran qui n'y répond pas sort du Hub.

D'abord pensé pour le PC, lisible et utilisable sur téléphone.

## 2. Trois chantiers, celui-ci est le premier

| Chantier | Contenu | Quand |
|---|---|---|
| **A — ce document** | Le nouveau Hub au design de la V2, avec toutes les fonctions vivantes d'aujourd'hui, l'ouverture (pouls, attente, santé, fil), la bascule de `hub.runesdechene.com` | maintenant |
| B — le parcours | Collecter d'où viennent les gens (liens et QR marqués par festival, Instagram, flyer ; sinon une question à l'inscription), la mesure du stand, la fidélité, les écrans de mesure | après A |
| C — les modérateurs | Des droits par domaine du menu | plus tard |

A range déjà les écrans par domaine pour que C s'y pose sans rien refaire. A ne collecte rien de
nouveau : tout ce qu'il montre se lit dans la base d'aujourd'hui.

## 3. Ce qui ne change pas

- La base, les RPC existantes, les buckets.
- Les adresses publiques, imprimées sur des QR : `/soumettre-contenu`, `/flyer`, `/flyercadeau`.
- Les fonctions Netlify vivantes (`flyer-create-account`, `stand-create-account`,
  `shopify-order-webhook`, `shopify-proxy`, `shopify-health-check`, `shopify-article`,
  `shopify-sync`, `shopify-batch-tags`, `shopify-sync-tags`, `shopify-callback`) : elles
  déménagent telles quelles. `shopify-create-customer` (appelée seulement par l'ancienne appli) ne
  déménage pas.
- L'entrée par code reçu par e-mail (le Hub actuel fait déjà comme la V2), réservée à
  `users.role = 'admin'`.

## 4. Architecture

**Une nouvelle appli `apps/hub-v2`, à côté de l'ancienne** — le chemin qui a marché pour la V2.
L'ancien Hub tourne jusqu'à la bascule, puis il est supprimé.

- **Même pile que `apps/web-v2`**, mêmes versions : Vite 8, React 19.3, React Router 8,
  TanStack Query 5, supabase-js 2.117, CSS modules, Vitest, ESLint et Stylelint avec la même
  règle « aucune valeur visuelle hors des jetons ».
- **Les jetons partagés : `packages/da`.** `tokens.css` et `global.css` quittent
  `apps/web-v2/src/shared/styles/` pour ce paquet ; la V2 et le Hub l'importent tous les deux.
  Les polices (`@fontsource/*`) y sont déclarées une fois. `/v2/da` reste dans la V2 et continue
  de montrer chaque jeton. Les composants, eux, ne sont **pas** partagés au départ : le Hub a ses
  briques propres (§6), on n'en met en commun que quand un même composant sert vraiment aux deux.
- **Les règles de la V2 s'appliquent** (`.claude/rules/v2.md`) : simplicité d'abord, tout est
  animé avec les deux mouvements des jetons, tout état navigable est une URL (une fiche en tiroir
  a son adresse), en-tête `QUOI / POURQUOI` sur chaque fichier, `README.md` par dossier.
- **Les données passent par des fonctions serveur** (`SECURITY DEFINER`, réservées aux admins par
  `_is_admin()` ; les modérateurs viennent avec le chantier C), comme dans la V2, pas par des lectures directes de tables. Les RPC du Hub
  actuel qui servent encore sont reprises ; les nouvelles se nomment en français
  (`hub_ouverture`, `fil_du_hub`, …).
- **Netlify** : un nouveau site pour `hub-v2` pendant la construction, déployé à la main
  (`--functions` inclus, voir `apps/hub/CLAUDE.md`). La bascule pose le domaine
  `hub.runesdechene.com` sur ce site.
- **Rangement** : `src/app/` (coquille, accès, routes), `src/features/<domaine>/` (un dossier par
  domaine du menu, chacun avec `api/`, `components/`, `hooks/`, `lib/`), `src/shared/` (briques).

## 5. La coquille

- **PC** : le menu à gauche (logo Explore, « Le Hub »), groupé par domaines, avec une pastille
  rouge du nombre d'éléments qui attendent. Le contenu sur le fond parchemin de l'appli, en mode
  « cover ». Une fiche s'ouvre en **tiroir à droite** (la largeur `--tiroir` de la V2), avec son
  adresse.
- **Téléphone** : la barre d'onglets de l'appli (85 px) — Accueil, Communauté, Le jeu, Boutique,
  Plus — et les blocs les uns sous les autres. Une fiche s'ouvre en pleine page.

**Le menu :**

| Domaine | Écrans |
|---|---|
| Accueil | l'ouverture (§7) |
| Communauté | Comptes, Compagnies, Lieux à modérer, Signalements |
| Le jeu | Énigmes, Énigmes signalées, Cultures, Natures, Titres, Bannières, Énergie |
| Fragments et boutique | Fragments (Shopify et scans), Photos et avis, Synchro Shopify, Écoutes audio |
| Parler aux joueurs | Mises à jour, Notifications, Blog de la boutique |
| Réglages | le texte de partage, l'image des pages SEO |

## 6. La direction artistique (validée le 14/10)

- Fond : la texture parchemin de l'Accueil, en « cover ». Une image se reprend **avec sa
  peinture entière** (réglages de couleur compris) — `.claude/rules/interface.md`. La texture
  actuelle est une image de téléphone (446 × 891) : il faut une grande image (≥ 2 880 px) pour
  le PC (point ouvert §13).
- En-tête de page : un surtitre (le domaine), le titre en Bebas, une phrase qui résume ; à droite
  un bouton au contour fin (période, export, téléchargement).
- Les chiffres : des **blocs clairs bordés** (contour fin, sans fond), le libellé en Cabin
  Condensed, la valeur en Bebas, l'écart à côté (vert si ça monte, gris sinon).
- Les titres de section : l'icône gravée de l'appli, le titre en Bebas, un filet jusqu'au bord.
- Les listes : un **bloc clair, arrondi (15 px) et bordé** (`#fef6eb`, filet `--color-sable`),
  une ligne par élément séparée d'un filet. Pas de cartes photo pour les listes.
- Les filtres : une gélule au contour fin, le choix actif en rouge.
- Les balises : des gélules colorées (Nouveau, Réactivé, En sommeil, Porteur, Admin ; et pour le
  fil, une couleur par type).
- Les briques à construire, une fois chacune (elles existent en composants dans la maquette) :
  le lien du menu, la tuile d'un chiffre, la ligne à traiter, la ligne d'activité, la ligne de
  compte, le bloc, le titre de section, la gélule de filtre, la balise, le tiroir.

Toute couleur de la maquette absente des jetons s'ajoute à `tokens.css` (et se voit sur `/v2/da`).

## 7. L'ouverture

Maquettes : « Hub — Ouverture (PC) · v2 respirée » (587:761), « Hub — Ouverture (téléphone) »
(597:1365).

1. **En-tête** : la date, « Bonjour Uriel », une phrase de la semaine, le choix de la période
   (aujourd'hui, 7, 30, 90 jours ; écarts calculés contre la période d'avant de même durée).
2. **Le pouls** : six chiffres — nouveaux comptes, comptes réactivés, actifs, lieux ajoutés,
   visites sur place, énigmes percées (définitions §8).
3. **Ce qui t'attend** : une ligne par file non vide, avec son nombre, un détail, et le lien vers
   l'écran. Photos et avis à valider · lieux à modérer · signalements de lieux · énigmes signalées
   · achats à associer à la main.
4. **La santé** : un point vert ou orange par service (§9).
5. **Le fil d'activité** : §10.

Une seule RPC `hub_ouverture(p_jours int)` rend l'en-tête, le pouls, l'attente et la santé ; le
fil a la sienne.

## 8. Les chiffres et les balises — définitions à valider par Uriel

Règle (Uriel, 14/10) : **chaque chiffre a une définition écrite, validée avant d'être codée.**
Les sources ont été relevées dans les migrations le 14/10.

| Nom | Définition | Source |
|---|---|---|
| Nouveaux comptes | comptes créés pendant la période | `users.created_at` |
| Comptes réactivés | anciens comptes entrés pour la première fois dans la V2 pendant la période ; un compte ne se réactive qu'une fois | `users.entree_v2_le` (première connexion à la V2, posée une seule fois par `touch_last_login` ; passé rempli le 14/10 depuis la Charte ou la dernière connexion après la bascule, mig 515), quand elle est postérieure de plus d'un jour à `created_at` |
| En sommeil | comptes créés avant la bascule (07/10/2026) qui ne sont jamais entrés dans la V2 | `users.created_at` < 07/10/2026 (minuit, heure de Paris) et `entree_v2_le` vide |
| Actifs | comptes qui ont ouvert l'appli pendant la période | `users.last_login_at` (écrit à chaque ouverture par `touch_last_login`) |
| Lieux ajoutés | lieux créés pendant la période | `places.created_at` |
| Visites sur place | marques posées sur place pendant la période | `places_discovered`, `method = 'gps'`, `discovered_at` |
| Énigmes percées | bonnes réponses pendant la période | `enigma_responses`, `correct`, `responded_at` |
| Porteur | compte qui a au moins un Fragment | `user_fragments` |
| Département d'un compte | le département où il a visité le plus de lieux | même calcul que `get_profil_explorateur` (`place_explorers` × `places.departement`) |

| Balise | Quand |
|---|---|
| Nouveau | compte créé il y a moins de 15 jours |
| Réactivé | réactivé il y a moins de 15 jours (Uriel, 14/10) |
| En sommeil | voir la définition ci-dessus (Uriel, 14/10) |
| Porteur | au moins un Fragment |
| Admin | `users.role = 'admin'` |

Vocabulaire : « Porteur », « client validé » ; jamais « client relié » (`.claude/rules/produit.md`).

## 9. Ce qui attend, la santé — sources

Ces lignes sont aussi des définitions : elles se valident comme celles du §8. La plus discutable
est « lieux à modérer » — il n'existe pas de statut de modération, seulement la marque « vérifié »
que le Hub pose aujourd'hui.

| Ligne | Source |
|---|---|
| Photos et avis à valider | `hub_photo_submissions.status = 'pending'` ; le plus ancien `created_at` |
| Lieux à modérer | lieux ajoutés depuis la bascule et jamais vérifiés (`places.verified_at` vide) |
| Signalements de lieux | `signalements_lieu.traite_le` vide |
| Énigmes signalées | `signalements_enigme.traite_le` vide |
| Achats à associer à la main | `purchase_log.status` dans `pending`, `no_match` |
| Synchro Shopify | la fonction `shopify-health-check` |
| Notifications | `notifications` créées sur la période et part lue (`read`) — il n'existe pas de suivi d'envoi ni d'échec |
| Commandes Shopify | date du dernier `purchase_log.created_at` ; orange au-delà de 3 jours sans commande |
| Appli Explore | la version servie par `app.runesdechene.com` |
| Fiches publiques `/lieu` | point ouvert (§13) : la reconstruction nocturne n'écrit son résultat nulle part de lisible |

## 10. Le fil d'activité

Tout ce que font les gens, avec plus de détails que l'appli publique. Chaque ligne : l'heure, le
type (gélule colorée), le portrait, qui et quoi, une ligne de détail réservée à l'équipe, le
département, le lien vers la fiche. Filtres par type, recherche par Explorateur ou lieu, « Voir
tout le fil ».

**Pas de nouvelle table.** Une RPC `fil_du_hub(p_types text[], p_avant timestamptz, p_limite int)`
rassemble ce que la base garde déjà, trié par date :

| Type | Source | Détail montré |
|---|---|---|
| Compte | `users.created_at`, `entree_v2_le` (réactivation) | provenance (`account_source`), Porteur, client validé (`shopify_customer_id`) |
| Lieu | `places` (ajout), `versions_lieu` (modification) | nature, nombre de photos, vérifié ou non |
| Visite | `places_discovered` (`gps`) | première visite de ce lieu ou non |
| Énigme | `enigma_responses` | culture, juste ou faux, rang de l'essai (nombre de réponses à cette énigme) |
| Boutique | `user_fragments` (`source = 'shopify'`), `purchase_log` | Fragments débloqués, commande |
| Photo | `hub_photo_submissions` | produit, nombre de photos, note |
| Message | `chat_messages` | canal |
| Modération | `signalements_lieu`, `signalements_enigme` | motif |
| Notification | `notifications` (regroupées par type et par heure) | combien de destinataires, combien l'ont lue |

**Ce que la maquette montre et que la base ne garde pas** — retiré du Hub A, sans rien ajouter :
la distance d'une visite (« à 120 m »), l'appareil d'un compte (« Android · Pythéas »), le festival
d'un flyer (chantier B), les échecs d'envoi des notifications.

## 11. Les écrans

**Le tri** (validé le 14/10) :

- **Repris** : comptes et fiche d'un compte, modération des lieux, signalements, énigmes, énigmes
  signalées, cultures, natures, titres, bannières, Énergie (relue par la V2, migration 399),
  Fragments Shopify et scans, association à la main, correspondance Shopify, écoutes audio,
  photos et avis, mises à jour, notifications.
- **Repris en partie** : tableau de bord (devient l'ouverture, sans le « Top Gloire » V1 ni le
  faux « réactivés ») · fiche d'un compte (sans « Donner des couronnes ») · Compagnies (nom,
  couleur, description, devise ; sans bonus V1) · Réglages (le texte de partage seul) · accueil V1
  (l'image des pages SEO seule) · synchro Shopify (lien compte-client et étiquette de provenance ;
  sans étiquette de faction) · annonces (le blog de la boutique seul).
- **Pas repris** : Missions, Publicités, Tutoriel, Règles du jeu, Divers, l'ancien écran
  Fragments, `shopify-create-customer`.

**Quatre modèles d'écran**, maquettés le 14/10 ; chaque écran repris en suit un :

| Modèle | Maquette | Écrans |
|---|---|---|
| Liste + fiche en tiroir | « Comptes : la liste » (594:961), « la fiche d'un compte » (595:1140) | Comptes, Compagnies, Lieux à modérer, Natures, Titres, Bannières, Cultures, Énigmes, Fragments |
| File de validation (deux volets) | « Photos et avis : la file » (596:1319) | Photos et avis, Signalements, Énigmes signalées |
| Tableau de bord | l'ouverture | Accueil, Écoutes audio, Notifications |
| Réglages (formulaire) | à maquetter au moment de l'écran | Énergie, Réglages, Synchro Shopify, Mises à jour, Blog |

**Comptes** : quatre chiffres (comptes, actifs, réactivés depuis la V2, en sommeil) ; filtres
Tous, Nouveaux, Réactivés, En sommeil, Porteurs, Équipe ; menus « Arrivés par » (`account_source`)
et « Département » ; tri ; recherche par nom ou e-mail ; export CSV. Colonnes : l'Explorateur et
ses balises, arrivé par, département, Fragments, dernière visite, inscription. **Le tiroir** : son
parcours (provenance, département, boutique, rôle avec « Changer » → `changer_role(p_user,
p_role)`), ce qu'il a fait (découverts, visites, ajoutés, énigmes), ses Fragments (+ associer à
la main), ses achats, ses dernières traces (le fil filtré sur lui).

**Photos et avis** : quatre chiffres ; filtres À valider, Publiées, Archivées, Toutes ; à gauche la
file, à droite la contribution choisie : le client, le produit, la note et le message, chaque photo
avec ses canaux (Communauté, Mur, Fiche produit, Média), les étiquettes ; Télécharger, Supprimer,
Archiver, « Valider et publier ». Mêmes RPC qu'aujourd'hui (`moderate_submission`,
`set_submission_image_*`, …).

## 12. Construire, vérifier, basculer

1. `packages/da` ; la V2 l'importe, son build et `/v2/da` restent identiques.
2. `apps/hub-v2` : la coquille, l'entrée par code, la porte admin.
3. Les briques (§6), puis l'ouverture et ses RPC.
4. Les écrans, domaine par domaine, chacun comparé à sa maquette à 1440 et 390 px avant d'être
   dit fini (`.claude/rules/v2.md`).
5. Les fonctions Netlify déménagent ; le webhook Shopify est repointé au moment de la bascule.
6. **La bascule** : le domaine passe au nouveau site, l'ancien Hub est retiré du dépôt et son site
   Netlify supprimé (avec l'accord d'Uriel), `.claude/rules/hub.md` réécrit (il décrit encore les
   couleurs et la police du Hub V1).

Tests : Vitest pour chaque définition de chiffre (fonctions pures) et chaque brique ; chaque écran
parcouru dans le navigateur ; `pnpm build` des deux applis ; console lue en prod après chaque
déploiement.

## 13. Points ouverts

1. **La contrainte `users_account_source_check` a dérivé** : les migrations n'acceptent que `app`,
   `shopify`, `stand`, mais la prod a 26 comptes `flyer` (le dernier le 03/10) — elle a été
   changée à la main. Une migration doit remettre le dépôt d'accord avec la prod.
2. **« En sommeil » et les comptes créés après la bascule** sans jamais entrer (comptes du stand
   ou du flyer) : quelle balise ? Proposition : aucune, ils sont « Nouveau » 15 jours puis rien.
3. **Le département dans le Hub** quand l'Explorateur a choisi de le cacher (`show_departement`) :
   proposition, l'équipe le voit (c'est un réglage d'affichage public), et le registre des
   traitements le mentionne.
4. **La santé des fiches publiques** : trouver où lire le résultat de la reconstruction nocturne,
   ou retirer la ligne.
5. **Une grande image de parchemin** pour le fond sur PC.
