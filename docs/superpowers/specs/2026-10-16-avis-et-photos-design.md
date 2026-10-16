# Avis et photos — un formulaire, deux chemins, des avis par type de vêtement

> Décidé avec Uriel le 16/10/2026. Maquette Figma « Runes de Chêne — App v2 », section
> **Avis et photos — formulaire (16/10)** (nœud 644:1612), validée le 16/10.
> État et décisions : vault, `1. LE MÉTIER/1. Runes de Chêne/Explore/_État.md` (Tranché).
> Chantier à part, **après la bascule du Hub** (il touche le thème Shopify et l'envoi d'e-mails).

## 1. Le besoin

Les clients envoient des photos portées avec un avis : parfait pour l'accueil de la boutique et le
mur « Ils nous portent ». Il manque des **avis écrits** sur la qualité du textile et l'expérience,
qu'on peut laisser sans photo (plus contraignante). Pas de second système : le formulaire actuel
(`/soumettre-contenu`, Hub V2) gagne un chemin « avis seul ».

## 2. Les règles (tranchées par Uriel le 16/10)

1. **Un formulaire, deux chemins**, choisis au premier écran : « Un avis avec photos » (≈ 3 min) et
   « Un avis seul » (≈ 30 s). Les ambassadeurs et partenaires prennent « avis avec photos » : leurs
   photos vont aussi sur l'accueil, la note et le petit mot y ont leur place.
2. **Les avis s'affichent par type de vêtement** (T-shirt, sweat, casquette…), jamais par motif :
   trop peu d'avis par motif, et le textile est le même d'un motif à l'autre.
3. **« Client vérifié »**, avec dessous en plus petit « (e-mail concordant) », quand l'e-mail donné
   correspond à un compte de l'appli qui possède **au moins un Fragment** (preuve d'un achat, en
   ligne ou au stand). Sinon, pas de mention. Ni code par e-mail ni lien signé. La boutique explique
   la mention : « l'adresse e-mail de l'auteur correspond à un client Runes de Chêne ».
4. **Chaque avis passe par la modération du Hub** avant publication, positif comme négatif (on ne
   refuse pas un avis parce qu'il est mauvais : Code de la consommation, L111-7-2 et D111-17).
5. **Un e-mail de demande d'avis part 14 jours** après une commande en ligne payée, ou après la
   création d'un compte au stand (« Associer un Fragment »). Son lien ouvre directement « Un avis
   seul », l'e-mail et le type de vêtement pré-remplis.
6. **Photos légères par défaut** (1 920 px, WebP qualité 0,82, comme aujourd'hui) ; la case « Garder
   mes photos en haute définition » (à cocher pour des photos de shooting, ou réutilisables pour notre
   communication) les passe à **4 000 px, qualité 0,9** — 4 000 px au plus : au-delà d'environ
   16 millions de pixels, Safari sur iPhone refuse la conversion.

## 3. Le formulaire (`apps/hub-v2/src/public/soumettre/`)

- **Écran 0, « Que veux-tu partager ? »** : deux cartes, et la phrase pour les ambassadeurs.
  Le choix est dans l'adresse (`?chemin=photos|avis`), comme l'étape (`?etape=`).
- **Avis avec photos** : les quatre étapes d'aujourd'hui (contenus, tailles, histoire, toi), plus la
  case haute définition sous les photos déposées ; « Ton histoire » demande le type de vêtement.
- **Avis seul** : deux étapes. « Ton avis » : le type de vêtement (pastilles T-shirt, Sweat,
  Casquette, Autre), « La qualité du textile » (étoiles), « Ton expérience avec Runes de Chêne »
  (étoiles), « Ton avis, en quelques mots ». « Toi » : prénom, e-mail.
- **Arrivée par le lien de J+14** : `?chemin=avis&email=…&type=…` saute l'écran 0. L'e-mail dans
  l'adresse n'est qu'un pré-remplissage : il ne donne rien de plus que le formulaire direct.
- Les libellés des notes deviennent « La qualité du textile » (aujourd'hui « produits ») et « Ton
  expérience avec Runes de Chêne ».
- `lib/compression.ts` : deux réglages, léger (1 920 px, 0,82) et haute définition (4 000 px, 0,9).

## 4. La base

- `deposer_contenu` (mig 501) exige 1 à 10 images : accepter **0 image pour un avis seul**, à
  condition d'au moins une note ou un texte. Nouveau paramètre : le type de vêtement.
- `hub_photo_submissions` : une colonne pour le **type de vêtement** (texte, liste fermée calquée sur
  le `product_type` de Shopify), et une pour le **chemin** (`avis`, `photos`) si `images` vide ne
  suffit pas à le dire. Les notes existent déjà (`rating_products`, `rating_experience`).
- **« Client vérifié » se calcule à la lecture** (e-mail de l'avis = e-mail d'un compte qui a au moins
  une ligne dans `user_fragments`), pas à l'envoi : un client qui reçoit son premier Fragment plus
  tard devient vérifié sans rien toucher.
- Une RPC publique en lecture pour le thème : les avis publiés d'un type de vêtement (prénom, date,
  notes, texte, « client vérifié »), sans e-mail — comme `get_community_photos_by_product`.

## 5. Le Hub (« Photos et avis »)

- Une balise par chemin : **Avis**, **Avis + photos**.
- Sur chaque avis : « ✓ Client vérifié (n Fragments) » ou « Aucun Fragment avec cet e-mail ».
- Un canal **« Boutique »** pour le texte de l'avis (publié ou non sur la page de son type), à côté
  des canaux de photos existants.
- Le type de vêtement affiché, modifiable (un client se trompe de case).

## 6. La boutique (thème Shopify, dépôt voisin `../shopify (Runes de Chêne)/`)

- Une section « Avis » sur la fiche produit : les avis du **type** du produit (`product.type`), la
  note moyenne, « ✓ Client vérifié » et « (e-mail concordant) » en plus petit dessous.
- La note moyenne en données structurées (`AggregateRating`), pour les étoiles dans Google.
- La phrase qui explique la mention et la modération, à côté des avis.

## 7. L'e-mail de J+14

- **Déclencheurs** : `orders/paid` (webhook déjà reçu, à repointer sur le Hub V2 à la bascule) et la
  création d'un compte au stand (`stand-create-account`).
- **Envoi** : une file en base (e-mail, type de vêtement, date d'envoi prévue), vidée chaque jour par
  une tâche planifiée qui passe par `send-email` (Resend). Un seul e-mail par adresse et par période,
  même avec plusieurs commandes.
- **Désinscription** : un lien pour ne plus recevoir ces demandes (e-mail transactionnel de suivi,
  mais on laisse le choix).

## 8. Points ouverts

- La liste des types de vêtement : à relever dans les `product_type` de la boutique.
- Le type d'une commande à plusieurs articles : un avis par type, ou le type principal ?
- Le délai exact : 14 jours après le paiement, ou après la livraison (`fulfillments`) ?
- Les avis de l'ancienne file (avec photos et notes) : les publier aussi par type, rétroactivement ?
- La maquette mobile du formulaire (le panneau clair seul, plein écran).
