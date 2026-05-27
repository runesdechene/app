# Bloc « Ils nous portent » par produit — Design

> Date : 2026-05-27 · Repos : `app (Runes de Chêne)` (cœur) + `shopify (Runes de Chêne)` (affichage)
> Statut : design validé, prêt pour plan d'implémentation

## Contexte

Aujourd'hui, une photo communautaire validée a deux destinations possibles :

1. **Mur « Ils nous portent »** (page dédiée) — section Shopify `community-photos.liquid` qui fetch `get_approved_photos_by_tag` depuis Supabase (anon key) côté client.
2. **Galerie produit** — une photo est liée à un produit (`hub_submission_images.shopify_product_id/handle/title`, mig 178) puis **poussée dans les médias Shopify** (`shopify_media_id`). Ce sont les photos ambassadeurs à `alt = prénom` affichées dans la galerie principale.

On veut un **3e niveau de granularité** : des photos liées à un produit mais **pas** dans la galerie principale (souvent de moins bonne qualité), affichées dans un **bloc « Ils nous portent » sous la fiche produit**, chacune accompagnée de l'**avis** de la personne.

## Objectif

Sous chaque fiche produit, afficher les photos « Communauté » approuvées de ce produit, avec, pour chaque envoi : la/les photo(s), un avis public (texte), deux notes /5, et l'identité de la personne (nom, instagram, lieu).

## Modèle de données (Supabase, repo app)

Nouvelle migration `supabase/migrations/180_ugc_community_block.sql` (numéro à ajuster selon l'état du dossier au moment de l'implémentation).

### `hub_photo_submissions` (niveau batch)
- `+ rating_experience int` — note /5, « Comment fut votre expérience Runes de Chêne ? »
- `+ rating_products int` — note /5, « Comment appréciez-vous vos produits ? »
- `+ team_note text` — **PRIVÉ**. « Un mot pour l'équipe ? ». Visible uniquement dans le Hub admin. **Jamais exposé** publiquement.
- `message` (existant) — **devient l'avis PUBLIC** (sur la marque / l'expérience). Affiché dans le bloc.

Contraintes : `rating_experience`/`rating_products` entre 1 et 5 quand renseignés (nullable — anciens envois sans notes).

### `hub_submission_images` (niveau photo)
- `+ show_in_community boolean not null default false` — flag destination « Communauté ».

Les colonnes produit (`shopify_product_id/handle/title`) et `shopify_media_id` (push galerie) existent déjà (mig 178). Les deux destinations sont **indépendantes** (ET/OU) :
- **Photo produit** = flux push galerie existant (`shopify_media_id` renseigné).
- **Communauté** = `show_in_community = true`.

### RPCs
- `set_submission_image_community(p_image_id uuid, p_show boolean)` — toggle le flag depuis le Hub (security definer, grant anon/authenticated/service_role comme les RPC de curation existantes).
- `get_community_photos_by_product(p_handle text)` — **lecture publique (anon)**. Retourne les photos `Communauté` d'un produit, jointes à leur batch :
  - Filtres : `i.show_in_community = true`, `i.status = 'approved'`, `s.status = 'approved'`, `s.consent_brand_usage = true`, `i.shopify_product_handle = p_handle`.
  - Colonnes retournées : `submission_id`, `image_url`, `image_sort_order`, `submitter_name`, `submitter_instagram`, `location_name`, `location_zip`, `message` (avis public), `rating_experience`, `rating_products`, `created_at`.
  - **`team_note` est EXCLU** de cette vue/RPC. Idem pour tout autre champ privé (email, etc.).

### Sécurité
- `team_note` ne doit apparaître dans **aucun** RPC/vue exposé à l'anon key (`get_community_photos_by_product`, `get_approved_photos_by_tag`, `movement_wall_photos`). Vérifier explicitement.
- Le RPC public ne renvoie que des envois approuvés + consentement marque.

## Hub (repo app, `apps/hub`)

### Formulaire de soumission — `StudioSubmit.tsx`
- Relabelliser le champ `message` pour clarifier qu'il s'agit d'un **avis public** (sur la marque / l'expérience).
- Ajouter 2 sélecteurs d'étoiles /5 : `rating_experience` et `rating_products` (libellés ci-dessus).
- Ajouter un champ texte **privé** « Un mot pour l'équipe ? » → `team_note`, avec mention explicite « privé, ne sera pas publié ».
- Écrire ces champs sur `hub_photo_submissions` à la soumission.

### Curation (UGC Studio admin)
- Pour une photo liée à un produit, exposer 2 contrôles indépendants :
  - **Photo produit** → action push galerie existante.
  - **Communauté** → toggle appelant `set_submission_image_community`.
- Afficher `team_note` (privé) à la modération, à côté du `message` public.

## Shopify (repo shopify)

### Section produit `sections/rdc_ils-nous-portent-produit.liquid`
- Calquée sur `community-photos.liquid` (même DA : grid portrait, mini-carrousel par carte, lightbox).
- Lit `{{ product.handle }}` sur la fiche produit.
- Fetch client-side `POST {supabase_url}/rest/v1/rpc/get_community_photos_by_product` avec `{ p_handle }`, anon key en réglage de section (comme `community-photos`).
- Groupe par `submission_id` (plusieurs photos d'un même envoi = une carte à carrousel).
- Chaque carte affiche : photo(s) + ⭐ expérience + ⭐ produits + message (avis) + nom / @instagram / lieu.
- Préfixe `rdc_` (convention thème). Réglages : `supabase_url`, `supabase_anon_key`, titre, sous-titre, colonnes.
- Ajoutée à `templates/product.json`, positionnée **sous** le bloc produit. État vide géré (aucune photo → section masquée ou message discret).

## Flux complet

```
Personne → formulaire Hub (photos + message public + 2 notes + mot privé équipe)
   → hub_photo_submissions / hub_submission_images (status pending)
   → curation Hub : lie la photo au produit, coche « Communauté » (et/ou « Photo produit »)
   → Supabase : show_in_community = true, status approved, consentement marque
   → fiche produit Shopify : fetch get_community_photos_by_product(product.handle)
   → bloc « Ils nous portent » rendu sous le produit (photos + avis + notes + personne)
```

## Hors scope (YAGNI)
- Modération automatique / IA.
- Édition de l'avis par l'admin (l'avis reste les mots de la personne ; relabel + notes seulement).
- SEO server-side du bloc (approche metafields/push — repoussée ; fetch client-side comme l'existant).
- Refonte du flux avis séparé (`hub_review_submissions`) — non touché.
- Pagination du bloc (volume faible attendu au lancement).

## Tests / vérification
- Migration : `rating_experience/products` bornés 1-5, `show_in_community` default false, `team_note` nullable.
- RPC `get_community_photos_by_product` : ne renvoie QUE approved + consentement + `show_in_community`, et **jamais** `team_note` (test explicite anon).
- Hub : soumission écrit les 3 nouveaux champs ; toggle Communauté bascule le flag ; `team_note` visible admin seulement.
- Shopify : sur une fiche produit avec photos Communauté → bloc rendu, notes/avis/personne corrects ; sur une fiche sans → bloc vide/masqué, pas d'erreur JS.

## Cross-repo & déploiement
- Migration + Hub + RPC : repo `app (Runes de Chêne)` (migration numérotée, déploiement Netlify manuel pour le Hub).
- Section : repo `shopify`, push `--only` vers le thème live (#180921794827) après validation sur aperçu.
