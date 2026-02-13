# Runes de Chêne - Documentation Thème Shopify

> **Thème de base:** Heritage v3.2.1 (Shopify - Catégorie Horizon 2026)  
> **Dernière mise à jour:** 27 janvier 2026

---

## � Commandes Shopify CLI

```bash
# Push les changements vers le thème dev
shopify theme push

# Pull les changements du thème dev
shopify theme pull

# Auto-sync pour développement (watch les fichiers et push automatique)
shopify theme dev --theme-editor-sync

# Push vers un thème spécifique
shopify theme push --theme=123456789

# Pull depuis un thème spécifique
shopify theme pull --theme=123456789
```

---

## �📁 Structure du Projet

```
RUNES DE CHENE (Shopify)/
├── assets/           # 114 fichiers (CSS, JS, SVG, images)
├── blocks/           # 94 fichiers (blocs réutilisables pour sections)
├── config/           # Configuration du thème
├── layout/           # Layouts principaux (theme.liquid, password.liquid)
├── locales/          # 51 fichiers de traduction
├── sections/         # 41 sections
├── snippets/         # 95 snippets réutilisables
└── templates/        # 13 templates JSON
```

---

## 🏗️ Architecture du Thème

### Layout Principal (`layout/theme.liquid`)

Point d'entrée du thème. Structure:

1. **Head**: meta-tags, stylesheets, fonts, scripts, variables CSS, color-schemes
2. **Body**:
   - Header group (`{% sections 'header-group' %}`)
   - Main content (`{{ content_for_layout }}`)
   - Footer group (`{% sections 'footer-group' %}`)
   - Modaux (search-modal, quick-add-modal)

### Système de Variables CSS (`snippets/theme-styles-variables.liquid`)

Génère toutes les variables CSS :

- **Typographie**: 4 familles de polices (body, subheading, heading, accent)
- **Couleurs**: via color_scheme_group
- **Espacements**: margins, paddings, gaps
- **Animations**: transitions, easing functions
- **Composants**: boutons, inputs, badges, drawers, popovers

### Système de Scripts (`snippets/scripts.liquid`)

- **Import Map** ES Modules avec alias `@theme/`
- **Modules principaux**: utilities.js, component.js, events.js, morph.js
- **Objet global `Theme`**: translations, routes, template info

---

## ⚙️ Configuration (`config/`)

### `settings_schema.json` - Paramètres du thème

| Section           | Description                             |
| ----------------- | --------------------------------------- |
| Logo & Favicon    | Images de marque                        |
| Colors            | Color schemes avec color_scheme_group   |
| Typography        | 4 polices + presets H1-H6 + paragraph   |
| Page Layout       | Largeur de page (narrow/normal/wide)    |
| Animations        | Transitions de page, hover effects      |
| Badges            | Position, couleurs, typographie         |
| Buttons           | Styles primaire/secondaire              |
| Cart              | Type (page/drawer), fonctionnalités     |
| Drawers           | Couleurs, bordures                      |
| Icons             | Épaisseur du trait                      |
| Input Fields      | Bordures, radius                        |
| Popovers & Modals | Styles                                  |
| Prices            | Affichage code devise                   |
| Product Cards     | Quick add, hover image                  |
| Search            | Collection état vide, predictive search |
| Swatches          | Dimensions, bordures                    |
| Variant Pickers   | Styles boutons                          |

### `settings_data.json`

Valeurs actuelles des paramètres du thème.

---

## 📄 Templates (`templates/`)

| Template              | Format | Description         |
| --------------------- | ------ | ------------------- |
| index.json            | JSON   | Page d'accueil      |
| product.json          | JSON   | Page produit        |
| collection.json       | JSON   | Page collection     |
| cart.json             | JSON   | Page panier         |
| blog.json             | JSON   | Liste articles      |
| article.json          | JSON   | Article de blog     |
| page.json             | JSON   | Page standard       |
| page.contact.json     | JSON   | Page contact        |
| search.json           | JSON   | Résultats recherche |
| 404.json              | JSON   | Page erreur         |
| list-collections.json | JSON   | Liste collections   |
| password.json         | JSON   | Page mot de passe   |
| gift_card.liquid      | Liquid | Carte cadeau        |

---

## 🧩 Sections Principales (`sections/`)

### Header & Footer

- `header.liquid` - Header principal avec menu, logo, actions
- `header-announcements.liquid` - Barre d'annonces
- `header-group.json` - Groupe header
- `footer.liquid` - Footer principal
- `footer-utilities.liquid` - Utilitaires footer
- `footer-group.json` - Groupe footer

### Pages Produit

- `product-information.liquid` - Informations produit principales
- `product-recommendations.liquid` - Recommandations
- `product-hotspots.liquid` - Points chauds sur images
- `featured-product.liquid` - Produit mis en avant
- `quick-order-list.liquid` - Commande rapide

### Collections & Listes

- `main-collection.liquid` - Grille collection
- `collection-list.liquid` - Liste de collections
- `product-list.liquid` - Liste de produits
- `collection-links.liquid` - Liens collections

### Contenu

- `hero.liquid` - Section héro
- `slideshow.liquid` - Diaporama
- `layered-slideshow.liquid` - Diaporama en couches
- `media-with-content.liquid` - Média + contenu
- `carousel.liquid` - Carrousel
- `marquee.liquid` - Texte défilant
- `section.liquid` - Section générique flexible

### Blog

- `main-blog.liquid` - Liste articles
- `main-blog-post.liquid` - Article individuel
- `featured-blog-posts.liquid` - Articles mis en avant

### Utilitaires

- `divider.liquid` - Séparateur
- `custom-liquid.liquid` - Code Liquid personnalisé
- `predictive-search.liquid` - Recherche prédictive

---

## 🔧 Blocs (`blocks/`)

### Convention de nommage

- `_nom.liquid` - Blocs internes/statiques (préfixe `_`)
- `nom.liquid` - Blocs standards

### Blocs Principaux

| Catégorie       | Blocs                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Produit**     | product-card, product-title, price, swatches, variant-picker, buy-buttons, product-description, product-inventory, sku |
| **Collection**  | collection-card, collection-title                                                                                      |
| **Contenu**     | text, heading, image, video, button, icon, spacer, divider                                                             |
| **Layout**      | group, accordion                                                                                                       |
| **Formulaires** | contact-form, email-signup                                                                                             |
| **Footer**      | footer-copyright, payment-icons, social-links, policy-list                                                             |

---

## 🎨 Snippets Clés (`snippets/`)

### Composants UI

- `product-card.liquid` - Carte produit
- `collection-card.liquid` - Carte collection
- `button.liquid` - Boutons
- `icon.liquid` - Icônes SVG (133KB - toutes les icônes)
- `price.liquid` - Affichage prix
- `quantity-selector.liquid` - Sélecteur quantité

### Layout & Structure

- `section.liquid` - Wrapper de section
- `group.liquid` - Groupement de blocs
- `bento-grid.liquid` - Grille bento

### Médias

- `image.liquid` - Images optimisées
- `video.liquid` - Vidéos
- `media.liquid` - Conteneur média générique
- `background-media.liquid` - Médias en arrière-plan
- `slideshow.liquid` - Composant slideshow

### Header

- `header-actions.liquid` - Actions header (cart, account, search)
- `header-drawer.liquid` - Menu drawer mobile
- `mega-menu-list.liquid` - Mega menu

### Cart

- `cart-products.liquid` - Liste produits panier
- `cart-summary.liquid` - Résumé panier
- `quick-add.liquid` - Ajout rapide
- `quick-add-modal.liquid` - Modal ajout rapide

### Formulaires

- `localization-form.liquid` - Sélecteur pays/langue
- `gift-card-recipient-form.liquid` - Formulaire carte cadeau

### Styles

- `color-schemes.liquid` - Schémas de couleurs CSS
- `theme-styles-variables.liquid` - Variables CSS globales
- `typography-style.liquid` - Styles typographiques
- `fonts.liquid` - Chargement polices

---

## 📜 JavaScript (`assets/`)

### Architecture ES Modules

Le thème utilise des ES Modules avec un import map défini dans `scripts.liquid`.

### Modules Principaux

| Module         | Description                        |
| -------------- | ---------------------------------- |
| `utilities.js` | Fonctions utilitaires globales     |
| `component.js` | Classe de base pour Web Components |
| `events.js`    | Système d'événements personnalisés |
| `morph.js`     | DOM morphing pour updates partiels |
| `scrolling.js` | Gestion du scroll                  |
| `focus.js`     | Gestion du focus accessibilité     |

### Composants

| Composant              | Description                      |
| ---------------------- | -------------------------------- |
| `product-form.js`      | Formulaire produit, ajout panier |
| `variant-picker.js`    | Sélection variantes              |
| `product-card.js`      | Interactions carte produit       |
| `slideshow.js`         | Diaporamas                       |
| `header.js`            | Comportement header              |
| `header-drawer.js`     | Menu mobile                      |
| `facets.js`            | Filtres collection               |
| `predictive-search.js` | Recherche prédictive             |
| `quick-add.js`         | Ajout rapide                     |
| `cart-icon.js`         | Icône panier avec compteur       |

### Animations

| Module                 | Description              |
| ---------------------- | ------------------------ |
| `view-transitions.js`  | View Transitions API     |
| `fly-to-cart.js`       | Animation ajout panier   |
| `layered-slideshow.js` | Slideshow en couches     |
| `marquee.js`           | Texte défilant           |
| `jumbo-text.js`        | Texte animé grand format |

---

## 🌍 Locales (`locales/`)

- **51 fichiers** de traduction
- **Langue par défaut**: `en.default.json`
- **Fichiers schema**: `*.schema.json` pour les traductions de l'éditeur de thème
- **Langues principales**: EN, FR, DE, ES, IT, PT, NL, JA, KO, ZH

---

## 🎯 Conventions de Développement

### Fichiers Personnalisés

> **IMPORTANT**: Tous les fichiers custom doivent être préfixés par `rdc_`
> Exemple: `rdc_custom-section.liquid`, `rdc_styles.css`

### Gestionnaire de Paquets

> **IMPORTANT**: Utiliser `pnpm` (pas npm ni yarn)

### Nomenclature des Blocs

- Blocs statiques/internes: préfixe `_` (ex: `_product-card.liquid`)
- Blocs publics: sans préfixe (ex: `button.liquid`)

---

## 🔄 Fonctionnalités Clés Heritage 2026

### View Transitions API

- Transitions de page fluides
- Transition produit card → page produit
- Configurable dans les paramètres

### Color Scheme Groups

- Système de couleurs moderne avec `color_scheme_group`
- Rôles définis (text, background, links, buttons...)

### Blocks Architecture

- Système de blocs imbriqués (`content_for 'block'`)
- Blocs statiques vs dynamiques
- Groupes de blocs

### Web Components

- Custom Elements pour interactivité
- Classe de base `component.js`
- Hydratation progressive

### Performance

- Import maps pour ES Modules
- Modulepreload pour modules critiques
- Lazy loading images
- fetchpriority pour scripts

---

## 📝 Notes de Maintenance

### À mettre à jour lors de changements majeurs:

1. Nouvelles sections/blocs personnalisés
2. Modifications de la structure de navigation
3. Ajout de nouvelles fonctionnalités
4. Changements dans le système de couleurs
5. Modifications JavaScript importantes

---

_Document généré pour faciliter la reprise de contexte entre sessions de développement._
