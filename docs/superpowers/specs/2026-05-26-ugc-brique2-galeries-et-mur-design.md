# UGC « Le Mouvement » — Brique 2 : exploitation (galeries produit + mur)

> Spec de **vision/design** (pas d'implémentation). Date : 2026-05-26.
> Cadre : 2ᵉ brique du modèle UGC. Spec parent : `2026-05-26-ugc-mouvement-model-design.md`.
> Objet : **réveiller le contenu approuvé dormant** en l'affichant sur deux surfaces —
> les fiches produit de la boutique et une page-manifeste « Le Mouvement » —, et donner
> au hub un **vrai picker produit Shopify** en remplacement du champ libre actuel.

---

## 1. Problème & point de départ

À l'issue de la Brique 1, on collecte, modère et **récompense** très bien. Mais l'approuvé
**ne ressort nulle part** : aucune surface publique automatisée ne sert le contenu. Le mur
« Ils nous portent » de la boutique est désactivé depuis avril 2026.

Constats d'ancrage (mai 2026, vérifiés dans le code) :

- **`product_worn` est du texte libre**, au niveau soumission (`update_submission_product_worn`)
  ET par image (`set_submission_image_product`, mig 176). Impossible de joindre fiablement une
  photo à une fiche produit.
- Le **`shopify-proxy.ts`** du hub est un **passe-plat admin générique** vers l'Admin API Shopify
  (auth admin + token env). Un picker produit et un push d'image sont donc faisables **sans infra neuve**.
- Les **produits Shopify ne sont pas synchronisés en local** (seuls les clients le sont, via `shopify-sync.ts`).
- **`seo-pages`** est un générateur statique **Node.js/TS pur** (zéro framework), déployé chaque nuit
  (cron GitHub Actions 3h UTC), servi sous `app.runesdechene.com/lieu/*` via un **rewrite Netlify 200**
  depuis `explore-web`. Il a déjà `lib/supabase.ts`, `templates/gallery.ts` (hero + miniatures +
  lightbox + swipe + clavier), `contribution-card.ts`, l'assemblage `page.ts`, le design parchemin,
  Schema.org/OG/sitemap.
- **`explore-web`** est une **SPA Vite pure** (aucun pré-rendu/SSG) → SEO faible.

---

## 2. Décisions d'architecture (arbitrées avec Uriel)

### D1 — Modèle d'affichage à deux étages (validé)
Deux surfaces, deux barres de qualité, **toutes deux dérivées de données déjà manipulées au hub** :

| Surface | Quelles photos | Geste admin | Mécanisme |
|---------|----------------|-------------|-----------|
| **Fiches produit** (carrousel natif Shopify) | Les **plus belles**, choisies **une par une** | « Relier à un produit » | **Push écriture** vers l'Admin API Shopify |
| **Mur « Le Mouvement »** | **Toutes les approuvées** (jamais les archivées, jamais sans consentement) | Automatique dès `status = approved` | **Lecture** build-time (seo-pages) |

Ce sont **deux tuyaux indépendants**. La fiche produit n'a pas besoin du chemin de lecture ;
le mur n'a pas besoin de l'Admin Shopify. Seul point commun : `hub_submission_images` reste la
source de vérité.

### D2 — Fiches produit : push dans la galerie NATIVE Shopify, pas un bloc séparé (validé)
**Contexte produit décisif** : peu de temps pour des shootings officiels. L'objection « ne pas
diluer les photos studio » tombe quand il n'y a quasi pas de photos studio à diluer. **L'UGC EST
le budget photo produit** : une fiche avec 1 photo officielle + plusieurs vrais portés convertit
mieux. On pousse donc l'image dans le **carrousel d'images natif** du produit Shopify (option A),
en fin de carrousel (après les éventuelles photos officielles). **Aucune édition de thème requise**
pour cette surface.

### D3 — Réversibilité par mémorisation de l'ID média Shopify (validé)
Pousser dans la galerie native crée une dette de synchro : Shopify ré-héberge l'image sous son
propre ID. On **mémorise le `shopify_media_id` renvoyé** sur la ligne `hub_submission_images`.
« Retirer du produit » (ou archivage de la photo au hub) ⇒ `DELETE` du média via cet ID. Pas
d'image orpheline sur la fiche.

### D4 — UX hub : deux boutons explicites, pas de couplage implicite (validé)
- **« Relier à un produit »** : ouvre le picker → sélection du produit → push immédiat de l'image
  vers ce produit + enregistrement (`product_id/handle/title` + `media_id`).
- **« Retirer du produit »** : `DELETE` du média Shopify + nettoyage des champs.

Geste **volontaire et réversible**, par image. (Écarté : pousser automatiquement dès qu'on tague —
trop d'effet de bord.)

### D5 — Vrai picker produit Shopify, remplace le champ libre (validé)
Dans `Photos.tsx`, au niveau **image** (`hub_submission_images`), l'input texte « Produit porté »
devient un **sélecteur Shopify** alimenté par le `shopify-proxy` existant. On stocke un
**identifiant stable** : `shopify_product_id` (clé de jointure), `shopify_product_handle` (URL fiche),
`shopify_product_title` (cache d'affichage). L'ancien `product_worn` texte est **conservé pour
l'historique**, non migré automatiquement (faible volume → re-tag à la demande).

> Recherche produits : à arbitrer au plan — GraphQL Admin `products(query:)` via le proxy (POST
> `graphql.json`) recommandé pour une recherche par titre fluide ; sinon liste REST + filtre.

### D6 — `alt` = nom du contributeur, TOUJOURS (validé)
L'attribut `alt` de l'image poussée porte le **nom de la personne** sur la photo. Double fonction :
crédit + SEO, **et signal métier** — c'est ainsi qu'on repère côté Shopify qu'un humain est présent
sur la photo (condition d'affichage). Exigence ferme.

> À vérifier au plan : la convention exacte attendue par le thème Shopify (format du `alt`, logique
> de filtrage d'affichage qui s'appuie dessus).

### D7 — Le mur vit dans `seo-pages`, à `app.runesdechene.com/mouvement` (validé)
**Pas** dans la boutique Shopify (Liquid), **pas** dans `explore-web` (SPA, SEO faible). `seo-pages`
coche les trois cases : **SEO natif** (HTML statique, Schema.org/OG/sitemap déjà en place),
**porte vers l'appli** (domaine `app.runesdechene.com` = monde de La Carte → 1er pas du tunnel
client→joueur), **coût dev faible** (réutilise galerie, data-layer, design existants).

URL servie via un **rewrite Netlify 200** (transparent, le jus SEO reste sur `app.runesdechene.com`) :

```toml
# explore-web/netlify.toml, avant le fallback SPA
[[redirects]]
  from = "/mouvement"
  to = "https://rdc-seo-pages.netlify.app/mouvement"
  status = 200
  force = true
```

### D8 — Pas de RPC publique anon : lecture build-time via service key (validé)
La « RPC publique read-only » envisagée dans le spec parent **disparaît**. Elle n'était nécessaire
que pour un fetch client-side depuis un thème Shopify. `seo-pages` build **côté serveur avec la
service key**. On ajoute une **vue SQL `movement_wall_photos`** (source unique de la règle de
filtrage) projetant les photos `status = 'approved'` **ET** `consent_brand_usage = true`, avec le
lien produit (`handle` + `title`) si la photo est reliée. Réutilisable plus tard (galerie in-app
Phase 3) sans rouvrir de surface publique.

### D9 — Fraîcheur du mur : rebuild nightly (validé)
Le mur se régénère via le **cron existant 3h UTC**. Suffisant pour une page-manifeste : une photo
approuvée apparaît sous 24 h. Rebuild instantané à la validation = **hors périmètre** (YAGNI).

### D10 — La page est un manifeste, pas qu'une galerie (validé)
`/mouvement` = **manifeste épique en héro** (la marque + l'appli + les gens qui partent à l'aventure,
ligne éditoriale bonapartiste de la Citadelle) **au-dessus** du mur de photos (réutilise `gallery.ts`).
Le label produit, quand il existe, est cliquable vers la fiche boutique. Renommage : l'ancienne page
boutique `/pages/ils-nous-portent` → **301** → `/mouvement`, + un lien d'entrée depuis la boutique
pour la découvrabilité.

---

## 3. Les deux flux

```
                         ┌─ « Relier à un produit » (picker) ─► POST image (alt=nom) ─► carrousel natif Shopify
photo approuvée au hub ──┤        └─ mémorise shopify_media_id ; « Retirer » / archivage ─► DELETE média Shopify
                         │
                         └─ status=approved + consentement ─► vue movement_wall_photos ─► build seo-pages ─► /mouvement
```

- **Fiche produit** = chemin **écriture** (Admin API via proxy). Pas de lecture publique.
- **Mur** = chemin **lecture** (build-time, service key). Pas d'Admin Shopify.

---

## 4. Surfaces & composants

### Hub — `Photos.tsx` (picker + push)
- Par image : bouton **« Relier à un produit »** → modale de recherche produit (proxy Shopify) →
  sélection → push (`POST /products/{id}/images.json`, `alt` = nom) → stocke
  `shopify_product_id/handle/title` + `shopify_media_id`.
- Bouton **« Retirer du produit »** (si déjà relié) → `DELETE` média + reset champs.
- Remplace l'input texte « Produit porté (tag hub) » par image. L'ancien `product_worn` reste visible.

### seo-pages — page `/mouvement`
- Nouvelle génération dans `build.ts` : `dist/mouvement/index.html` (one-off, hors boucle `/lieu`).
- Data-layer : lecture de la vue `movement_wall_photos` (service key).
- Template : section manifeste (héro éditorial) + mur réutilisant `gallery.ts` ; label produit
  cliquable → fiche boutique. Design parchemin existant, Schema.org/OG/canonical.

### Routing & boutique
- `explore-web/netlify.toml` : règle rewrite `/mouvement` (cf. D7).
- Shopify : redirection `301 /pages/ils-nous-portent → /mouvement` + lien d'entrée depuis la boutique.

---

## 5. Data model

**Net-new (`hub_submission_images`)** :
- `shopify_product_id` (TEXT/BIGINT) — clé de jointure produit
- `shopify_product_handle` (TEXT) — URL fiche
- `shopify_product_title` (TEXT) — cache d'affichage
- `shopify_media_id` (TEXT/BIGINT, nullable) — ID média retourné par Shopify au push ; NULL = non poussé

**Net-new (vue)** : `movement_wall_photos` — projection lecture seule : `approved` + `consent_brand_usage = true`,
champs sûrs uniquement (url image, nom/instagram contributeur, `product_handle`/`product_title` si reliés,
message éventuel), triable/paginable.

**Réutilisé** : `shopify-proxy.ts`, bucket `community-photos`, modération hub, `gallery.ts` &
data-layer seo-pages, cron nightly seo, rewrites Netlify.

**Conservé sans migration** : `hub_submission_images.product_worn` (texte), `update_submission_product_worn`
(historique).

---

## 6. Hors-périmètre (confirmé)
- **Repost réseaux** (l'outil ZIP du hub existe déjà, gain quasi nul) — reporté.
- **Galerie communauté in-app** (Phase 3) — la vue `movement_wall_photos` est conçue réutilisable.
- **Rédaction finale du manifeste** (éditorial, ligne bonapartiste) et **design pixel** (frontend-design à l'implémentation).
- **Rebuild instantané** du mur à la validation (YAGNI ; nightly suffit).
- **Programme Ambassadeur / coup de cœur** (Brique 4).

## 7. À vérifier au plan
- Convention exacte du `alt` attendue par le thème Shopify (D6) et logique d'affichage qui s'en sert.
- Mécanisme de recherche produit via le proxy (GraphQL `products(query:)` vs liste REST) (D5).
- Niveau de liaison : produit (retenu) vs variante — confirmer que le produit suffit.
- Version Admin API (le proxy cible `2026-01`) pour `images.json` / suppression média.
- Présence/absence de prerendering côté seo-pages pour la nouvelle route (a priori statique pur, OK).
