# Hub — Redesign de la section Photos (modération) — Design

> Spec de **vision/design** (pas d'implémentation). Date : 2026-05-26.
> Objet : refondre l'UI de modération photos du hub (`Photos.tsx`), devenue brouillonne et
> vieillotte, en un outil **pratique** master-détail — sans perdre une seule fonctionnalité,
> et en découpant le monolithe en composants ciblés.

---

## 1. Problème

`apps/hub/src/components/Photos.tsx` est un **monolithe d'environ 920 lignes** qui fait tout :
filtres, gestion des tags, téléchargement ZIP, édition message, curation par photo, picker
produit (Brique 2), modération + récompense Couronnes, lightbox. L'affichage est une **grille de
cartes surchargées** : l'information et les contrôles s'empilent dans chaque carte, l'édition
inline est maladroite, la curation par photo est cachée derrière un bouton « Gérer les N photos ».
**Tout marche**, mais c'est dense, daté, et peu efficace pour modérer du volume.

---

## 2. Décisions (validées avec Uriel via maquettes)

### D1 — Layout master-détail (validé)
Trois zones : **barre d'outils** en haut, **file des soumissions** à gauche (liste scrollable),
**panneau détail** à droite (la soumission sélectionnée, avec tous ses contrôles). Triage rapide :
on parcourt la liste, on agit dans le panneau. Tient le volume sans surcharger une carte.

### D2 — Curation par photo inline dans le détail (validé)
La curation par image (Garder/Archiver + lien produit) vit **directement dans le panneau détail**,
section « Photos (N) ». On **supprime le bouton « Gérer les N photos »** et l'état `expandedId`.

### D3 — Barre d'actions de modération ancrée (validé)
En bas du panneau détail, une barre **adaptée au statut** :
- `pending` : champ 🪙 Couronnes + **Valider (+N)** + Archiver + Supprimer
- `approved` : Archiver + Supprimer
- `archived` : champ 🪙 + **Re-valider (+N)** + Supprimer

### D4 — Recherche (validé)
Champ de **recherche par nom / email** dans la barre d'outils (filtrage client sur la liste chargée).

### D5 — Retrait du champ libre « Produit porté » au niveau soumission (validé)
`update_submission_product_worn` / l'édition inline `product_worn` au niveau **soumission** sont
**retirés de l'UI** (remplacés par le **picker produit par photo**, Brique 2). La colonne DB
`hub_photo_submissions.product_worn` et la RPC restent en base (historique, **aucune migration**) ;
elles ne sont simplement plus utilisées par l'écran. Le nom de fichier ZIP (`buildDownloadName`)
cesse d'utiliser `product_worn`.

### D6 — Cohérence visuelle avec le hub (validé)
On **modernise dans le langage parchemin existant du hub** (mêmes variables/police/teintes que les
autres pages : Users, Dashboard…). Pas de nouveau design system : meilleure hiérarchie, espacement,
composants propres (lignes de liste, badges, boutons). La page Photos doit rester cohérente avec le
reste du back-office.

### D7 — Découpage en composants (architecture)
`Photos.tsx` (conteneur) garde l'état et les appels Supabase, et orchestre des composants ciblés
sous `apps/hub/src/components/photos/` :
- `PhotosToolbar` — filtres (statut/rôle/tags), recherche, « Gérer les tags », téléchargement ZIP
- `SubmissionList` — la file master (lignes : vignette · nom · statut · méta)
- `SubmissionDetail` — le panneau détail (en-tête identité, aperçu, message/tags/badges, barre d'actions)
- `ImageCurator` — une photo dans le détail : aperçu + Garder/Archiver + picker produit + download
- `TagManager` — création/suppression de tags (extrait tel quel)
- `Lightbox` — visionneuse (extrait tel quel)
- `usePhotosModeration` (hook, optionnel) — fetch + mutations si le conteneur devient trop gros

**Toute la logique existante (RPCs, états, handlers) est préservée**, juste répartie. Objectif : des
fichiers focalisés et lisibles plutôt qu'un fichier de 920 lignes.

### D8 — Desktop-first, repli responsive (validé par défaut)
Le hub est un back-office desktop (port 3001). Master-détail optimisé desktop ; sur écran étroit,
repli en **liste seule → détail en plein écran** (le détail s'ouvre par-dessus, bouton retour).

---

### D9 — Détail adaptatif selon le statut, focus curation pour les Validées (validé)
« Validées » n'est **pas une page séparée** : c'est le même master-détail filtré sur `approved`.
Mais le panneau détail **s'adapte au statut** :
- **`pending`** → emphase **modération** : barre Valider/Couronnes/Archiver/Supprimer en avant.
- **`approved`** → emphase **curation + lien produit** : actions de modération allégées (Archiver/Supprimer),
  et au centre une **visualisation photo-par-photo** — **une grande image** + **strip de vignettes**
  pour naviguer + plein écran (lightbox) — couplée, pour la photo courante, à une **recherche produit
  confortable** (champ large + résultats Shopify : **vignette · nom · prix**), pas un mini-dropdown.

**Conséquence d'implémentation** : la lib `shopifyProducts.searchShopifyProducts` (Brique 2) doit être
**étendue pour renvoyer le prix** (`ShopifyProductHit.price`), via la requête GraphQL Admin
(`priceRangeV2.minVariantPrice { amount currencyCode }`). Affichage formaté (ex. « 49 € »).
Pas de variantes/stock (YAGNI, non demandé).

## 3. Fonctionnalités à préserver (checklist anti-régression)

**Barre d'outils :** filtre statut (pending/approved/archived/all) · filtre rôle
(all/client/ambassadeur/partenaire) · filtre par tag · gestion des tags (créer/supprimer) ·
téléchargement ZIP « depuis le [date] » avec compteur · lien « Ouvrir le formulaire photos ↗ » ·
**(net-new)** recherche nom/email.

**Liste (master) :** vignette (1re image, support vidéo) · nom · statut · indicateurs (nb de
fichiers, consentement, nb de tags). Élément sélectionné surligné.

**Détail (panneau) :** nom + badge rôle · email · instagram · lieu (`location_name`/`location_zip`) ·
département · quête (`quest_ref`) · badges morphologie (`product_size`, `model_height_cm`,
`model_shoulder_width_cm`) · message éditable · tags (ajout/retrait + dropdown) · date · badge statut ·
badge « Diffusion OK » · télécharger la soumission (1 fichier = direct, sinon mini-ZIP).

**Curation par photo (`ImageCurator`) :** aperçu (image/vidéo, clic → lightbox) · taille portée
(`size`, « Aucun produit » si `none`) · Garder/Archiver (`set_submission_image_status`, avec
sync-back Shopify à l'archivage) · picker produit Relier/Retirer (Brique 2) · télécharger la photo.

**Modération :** crédit Couronnes paramétrable + Valider / Archiver / Supprimer selon statut
(`moderate_submission`, `delete_submission`). Lightbox (préc./suiv./fermer, clavier).

---

## 4. Hors-périmètre
- **Aucun changement backend** (pas de nouvelle RPC, pas de migration). Pur frontend hub.
- Le **formulaire public `StudioSubmit.tsx`** (collecte) — non concerné.
- Le **pixel-final** : on suit le langage parchemin du hub et on peaufine à l'implémentation
  (palette/teintes des badges statut conservées : pending #f59e0b, approved #22c55e, archived #6b7280).
- La section **Reviews** (`Reviews.tsx`) — pourra être réalignée plus tard sur le même patron, hors de ce spec.

## 5. Critère de succès
Modérer une soumission (parcourir → ouvrir → curer les photos → relier un produit → valider avec
Couronnes) se fait **sans scroll erratique ni recherche des contrôles**, dans un écran cohérent avec
le reste du hub, et `Photos.tsx` n'est plus un monolithe.
