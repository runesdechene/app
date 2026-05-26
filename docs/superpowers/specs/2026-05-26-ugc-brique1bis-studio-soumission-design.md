# UGC Brique 1bis — Le Studio de soumission

> Spec de **vision/conception** (pas d'implémentation). Date : 2026-05-26.
> Prolonge la Brique 1 (`2026-05-26-ugc-mouvement-model-design.md` + boucle récompense live).
> Objet : refondre la collecte photo en **studio guidé** (multi-contenus, multi-produits, sexy)
> + faire passer la récompense d'un **montant fixe automatique** à un **montant manuel décidé à la
> validation**, avec **curation par photo**.

---

## 1. Pourquoi

Les gens envoient des photos **en vrac** : plusieurs clichés, plusieurs produits, parfois sans
produit du tout. Le formulaire actuel (`PhotoSubmit.tsx`, scroll classique, 1 contexte) est
inadapté et peu engageant. Et la récompense fixe (Brique 1) ne reflète pas la **qualité** réelle
d'un shooting. On veut : un studio **qui prend par la main**, et une récompense **au mérite**.

## 2. Décisions (arbitrées avec Uriel, 2026-05-26)

### D1 — Récompense : montant **manuel** à la validation (révise la Brique 1)
Au hub, à la validation d'un envoi, **tu fixes un seul montant de Couronnes** pour l'ensemble,
selon la qualité. Ce montant **remplace** l'ancien automatique (`ugc_reward_crowns` + bonus 1re
contribution). Le **bonus de bienvenue** (création de compte, comptes neufs) **reste automatique**.
S'applique aux soumissions photo **et** aux avis (`moderate_submission` + `moderate_review`).

### D2 — Curation **par photo** (découplée du paiement)
Chaque photo d'un envoi est **validée ou archivée** individuellement → détermine ce qui sera
**affiché** plus tard (fiches produit, mur). Un envoi peut donc avoir 4 photos gardées + 2 archivées,
pour **un seul** montant de Couronnes. La récompense paie l'effort global ; la curation pilote l'affichage.

### D3 — Le contributeur donne la **taille** ; toi tu tagues le **produit**
Répartition du travail : le contributeur renseigne (par photo) **sa taille** — la seule donnée qu'il
détient. Le **produit porté** est tagué **par toi au hub** (tu reconnais tes pièces). Cas explicite :
**« Aucun produit porté »** par photo (paysage, flat-lay, détail) — distinct d'un « non renseigné ».

### D4 — Studio guidé en 4 étapes (fini le scroll)
1. **Tes contenus** — gros drop photos/vidéos (≤ 10).
2. **Les tailles** — on glisse d'un contenu à l'autre ; par contenu : une **puce taille** (XS→XXL) **ou** « Aucun produit porté ». Optionnel.
3. **Ton histoire** — un mot global libre + **Département** (liste FR, **optionnel** — étrangers exemptés).
4. **Toi** — prénom + email + consentements → Envoyer.

### D5 — Pré-câblage quête (système = Phase 2)
Le studio lit un param d'URL `?quete=ID`, le stocke (colonne nullable), le hub l'affiche
(« Quête : … »). La **création de quêtes + l'UI in-app = Phase 2**.

### D6 — Esthétique « studio » (style `app.runesdechene.com`)
Console **2 colonnes** sur desktop, **empilée plein écran** sur mobile (une étape à la fois, swipe) :
- **Gauche** : image **dédiée** (asset configurable, distincte du fond), opaque + voile sombre ; titre
  **« Envoyer mes contenus »** (Bebas Neue) ; **tracker d'étapes** (1✓ 2• 3 4) ; phrase d'accroche.
- **Droite** : panneau **parchemin** (crème `#f4ecd8`) avec l'étape active (lisible).
- **Fond de page** : image **landing** (`landing_image_desktop_url`) plein écran + Ken Burns + voile.
- Typo **Bebas Neue** (titres) / **Cabin** (corps) ; encre `#2a2418`, rouge `#963e3e`, crème, or `#b8945a`.
- Boutons « Suivant » **discrets** (Cabin Condensed, pas de pavé). Reveals slide doux. `prefers-reduced-motion` respecté.
- Pas de liseré clair autour de la console (ombre portée seule).
- Maquette validée : `.superpowers/brainstorm/1966-1779804904/content/studio-v6.html`.

## 3. Modèle de données

`hub_submission_images` (par photo) :
- `+ size text` (nullable) — taille saisie, **ou** sentinelle `'none'` = « aucun produit porté » (distinct de NULL = non renseigné).
- `+ status text` (`pending`/`approved`/`archived`, défaut `pending`) — curation d'affichage par photo.
- `+ product_tag` — association produit **par photo**, posée au hub (réutiliser/étendre `hub_photo_tags` au niveau image, ou champ `product_worn` par image — à trancher au plan).

`hub_photo_submissions` :
- `+ departement text` (nullable).
- `+ quest_ref text` (nullable, pré-câblage quête).
- `+ reward_crowns int` (nullable — montant manuel fixé à la validation).
- `message` (existant) = mot global de l'envoi.

## 4. Logique récompense (révision)
- `moderate_submission` / `moderate_review` prennent un **paramètre montant** (`p_crowns`) au lieu de
  lire les montants fixes. Crédit idempotent conservé (`rewarded_at`). Notif `contribution_approved`
  + email affichent **ce** montant.
- Suppression du crédit auto `ugc_reward_crowns` + bonus 1re contribution dans la modération.
- `create_user_from_submission` (bonus bienvenue) **inchangé**.
- Nouveau RPC de curation par photo : `set_submission_image_status(p_image_id, p_status)` (ou batch).

## 5. UI hub (`Photos.tsx`)
Refonte modération : par envoi → vignettes avec **garder/archiver par photo** + **tag produit par photo**,
**un champ Couronnes** pour l'envoi (à la validation), et affichage **taille / « aucun produit » / département / quête**.

## 6. Périmètre & découpage
Le **studio** remplace `PhotoSubmit.tsx` (photos). `ReviewSubmit.tsx` (avis) garde son formulaire ;
seule sa **récompense** passe en manuel (D1). Deux plans :
- **1bis-A** — Données (par-photo size/status/produit, submission dept/quest/reward_crowns) + révision
  récompense manuelle + refonte UI modération hub (`Photos.tsx`) + RPC curation par photo.
- **1bis-B** — Le **studio public** (wizard 4 étapes, drop, tailles+« aucun produit », dept, quête, esthétique parchemin/landing).

## 7. Hors périmètre
- Système de **quêtes** (création + UI in-app) → Phase 2 (seul le pré-câblage est en V1).
- **Surfaces d'affichage** de l'approuvé (fiches produit, mur) → Brique 2.
- Picker produit Shopify côté contributeur (le produit reste tagué au hub).
