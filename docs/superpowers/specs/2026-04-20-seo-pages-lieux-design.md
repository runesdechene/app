# SEO Pages Lieux — Redesign "Guide du Patrimoine"

> Spec validée le 20 avril 2026.
> Mockup de référence : `.superpowers/brainstorm/11873-1776707996/content/full-mockup.html`

## Résumé

Redesign complet des pages SEO statiques (`carte.runesdechene.com/lieu/[slug]`). Direction artistique : **guide du patrimoine avec âme d'aventurier** — parchemin/médiéval accessible, jamais trop fantasy. Chaque page a sa propre identité visuelle grâce au tag dominant du lieu.

## Décisions de design

| Choix | Décision |
|-------|----------|
| Layout desktop | Split asymétrique 40% galerie / 60% contenu |
| Layout mobile | Empilé (galerie → contenu) |
| Colonne gauche | Galerie photo verticale (3:4) + thumbnails, sticky au scroll |
| Colonne droite | Type → Titre → Adresse → Tags → Divider → Description → Contribution vedette → CTA |
| Tags | Pills colorées sous le titre, tag principal plus gros (hiérarchie) |
| Tag dominant | Gradient subtil qui teinte le haut de page (couleur du tag principal) |
| Header | Sticky minimal : logo image (pas texte) + CTA "Ouvrir dans l'app" |
| Breadcrumb | `La Carte › [Type] › [Nom du lieu]` — schema.org BreadcrumbList |
| Contributions | Meilleure (votes_up) en vedette, style "entrée de carnet" (parchment-dark, border-left accent). Reste en accordéon "Voir les N autres récits" |
| CTA | Contextuel au lieu : "Explorez [Nom] — ajoutez vos photos, gagnez de la Gloire". Intégré dans le flux + lien dans le footer |
| Lieux proches | Grille 4 colonnes (desktop) / 2 colonnes (mobile) |
| Ton visuel | Parchemin médiéval grand public, pas cosplay fantasy |

## Palette & Typographie

Alignée sur l'app principale (`explore-web/src/index.css`) :

```
--parchment:      #f7ede1
--parchment-dark:  #E8D5BE
--ink:            #4A3728
--ink-light:      #7D5A3C
--sepia:          #C19A6B
--sepia-dark:     #A0784C
--accent:         #833434

--font-title:  'Bebas Neue', sans-serif
--font-accent: 'Cabin Condensed', sans-serif
--font-body:   'Cabin', sans-serif
```

Tailles de texte (lisibilité prioritaire) :
```
h1 (titre lieu):     52px desktop / 38px mobile
place-type label:    13px
address:             15px
tags pills:          13px (secondary) / 14px (primary)
description body:    17px, line-height 1.9
contribution text:   16px
breadcrumb:          13px
CTA heading:         32px (Bebas Neue)
CTA body:            15px
nearby card title:   15px
```

Assets logo :
- Header : image logo Runes de Chêne (webp depuis CDN Shopify, ~26px height)
- Footer : même logo
- CTA : logo petit format ou emblème au-dessus du texte

Variable dynamique par page :
```
--tag-dominant:    [color du tag principal]
--tag-dominant-bg: [color du tag principal + 12% opacité]
```

## Structure de page (HTML sémantique)

```
<header>              — sticky, logo + CTA
  <nav.breadcrumb>    — La Carte › Type › Lieu (schema.org BreadcrumbList)
</header>

<div.page-tint>       — gradient tag dominant

  <main.split>        — grid 40/60
    <aside.gallery>   — sticky, photo 3:4 + dots + thumbnails
    <article.content>
      <span>            — place_type.title (label)
      <h1>              — place.title
      <p.address>       — place.address
      <div.tags>        — pills (primary larger) avec icon SVG mask
      <hr.divider>
      <div.description> — seo_description (ou text fallback)
      <section.contribution-featured>
        — avatar, nom, date, votes, texte en italique « », images
      <button.accordion> — "Voir les N autres récits"
      <div.cta>         — contextuel au lieu
    </article>
  </main>

</div>

<section.nearby>       — grille 4 lieux, chaque carte = image + type + nom + lien
<footer>               — logo, texte marque, liens (Carte, Boutique, Instagram, App)
```

## Data layer — Modifications requises

### Enrichir `places.ts`

Le data layer actuel (`src/lib/places.ts`) utilise `place_types` mais pas `tags`. Il faut :

1. **`getAllPlacesWithSlugs()`** — ajouter le join sur `place_tags` → `tags` pour récupérer `id, title, color, background, icon` de chaque tag, et identifier le `primary` (premier tag ou tag avec `is_primary`).

2. **Nouveau type `PlaceTag`** :
   ```ts
   interface PlaceTag {
     id: string
     title: string
     color: string
     background: string
     icon: string | null
     isPrimary: boolean
   }
   ```

3. **Enrichir le type `Place`** : ajouter `tags: PlaceTag[]` et `primaryTag: PlaceTag | null`.

4. **Fix limite 1000 rows** : implémenter la pagination dans `getAllPlacesWithSlugs()` (boucle avec `range(from, to)` par tranches de 1000).

### Données déjà disponibles (pas de changement)

- `place_type` (title, color) — déjà jointé
- `seo_description` — déjà disponible
- `contributions` via `getPlaceContributions()` — déjà OK (votes_up, images, user_name)
- `nearby` via `getNearbyPlaces()` — déjà OK

## Composants Astro — Architecture

### Composants à réécrire (existants)

| Composant | Rôle redesigné |
|-----------|---------------|
| `Header.astro` | Sticky header minimal + breadcrumb avec schema.org |
| `Hero.astro` | **Supprimé** — remplacé par `Gallery.astro` dans le split |
| `ValuesBar.astro` | **Supprimé** — remplacé par les tags dans le contenu |
| `PlaceContent.astro` | Description + contribution vedette + accordéon |
| `PlaceInfo.astro` | **Supprimé** — info accessibilité intégrée dans PlaceContent si présente |
| `CtaDownload.astro` | CTA contextuel (texte dynamique avec nom du lieu) |
| `NearbyPlaces.astro` | Grille 4 colonnes avec cards + image + type coloré |
| `BrandBlock.astro` | **Fusionné dans Footer** |
| `Footer.astro` | Logo + texte + liens (Carte, Boutique, Instagram, App) |

### Nouveaux composants

| Composant | Rôle |
|-----------|------|
| `Gallery.astro` | Photo principale 3:4 + dots de navigation + row de thumbnails |
| `Breadcrumb.astro` | Nav `La Carte › Type › Lieu` + JSON-LD BreadcrumbList |
| `TagPills.astro` | Pills colorées avec hiérarchie (primary plus gros) + icônes SVG mask |
| `ContributionCard.astro` | Carte "entrée de carnet" pour une contribution (réutilisée dans vedette et accordéon) |

### Layout `Base.astro`

- Ajouter la variable CSS `--tag-dominant` et `--tag-dominant-bg` dérivées du tag principal
- Mettre à jour les meta tags (og:image, description)
- Ajouter le JSON-LD `TouristAttraction` existant (déjà en place)
- Ajouter le JSON-LD `BreadcrumbList`

## Page `[slug].astro` — Structure cible

```astro
<Base title={...} tagDominantColor={primaryTag?.color}>
  <Header />
  <Breadcrumb type={place.place_type.title} placeName={place.title} />
  <div class="page-tint">
    <main class="main-split">
      <Gallery images={place.images} />
      <article>
        <span class="place-type">{place.place_type.title}</span>
        <h1>{place.title}</h1>
        <p class="address">{place.address}</p>
        <TagPills tags={place.tags} />
        <hr class="divider" />
        <PlaceContent
          description={place.seo_description || place.text}
          featuredContribution={contributions[0]}
          remainingCount={contributions.length - 1}
          contributions={contributions.slice(1)}
        />
        <CtaDownload placeName={place.title} />
      </article>
    </main>
  </div>
  <NearbyPlaces places={nearby} />
  <Footer />
</Base>
```

## CSS Architecture

Un seul fichier `global.css` restructuré avec les sections :
1. Variables & reset
2. Header & breadcrumb
3. Page tint (gradient dynamique)
4. Split layout (grid 40/60)
5. Gallery (sticky, photo, thumbs)
6. Content (type, title, tags, description)
7. Contributions (featured card, accordion)
8. CTA contextuel
9. Nearby grid
10. Footer
11. Mobile breakpoint (768px)

## SEO & Schema.org

### JSON-LD existant (TouristAttraction)
Déjà implémenté, à conserver tel quel.

### JSON-LD à ajouter (BreadcrumbList)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "La Carte", "item": "https://carte.runesdechene.com" },
    { "@type": "ListItem", "position": 2, "name": "[Type]", "item": "https://carte.runesdechene.com/lieu?type=[type-slug]" },
    { "@type": "ListItem", "position": 3, "name": "[Nom du lieu]" }
  ]
}
```

### Meta tags
- `<title>` : `[Nom du lieu] — Runes de Chêne` (déjà OK)
- `<meta description>` : `seo_description` tronquée à 155 chars (déjà OK)
- `og:image` : première image du lieu (déjà OK)
- Canonical URL (déjà OK)

## Responsive

| Breakpoint | Comportement |
|-----------|-------------|
| > 768px (desktop) | Split 40/60, galerie sticky, nearby 4 colonnes |
| ≤ 768px (mobile) | Empilé, galerie non-sticky (aspect-ratio 4:3), nearby 2 colonnes, titre 36px |

## Hors scope

- Déploiement Netlify (session séparée)
- Sitemap Google Search Console
- Fix limite 1000 rows (inclus dans le data layer, sera fait dans cette implémentation)
- Pages index par type (`/lieu?type=chateau`) — futures, les breadcrumbs pointent vers elles mais elles peuvent être 404 pour l'instant
- Génération de nouvelles descriptions Haiku
- Dark mode
