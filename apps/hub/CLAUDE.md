# Hub — Runes de Chêne (Back-office admin)

> Dernière mise à jour : 1er avril 2026 (soir — UserDetail, fix webhook Unlocks)

## Rôle

Le Hub est le back-office admin de Runes de Chêne. Il gère les paramètres du jeu, le contenu, les joueurs et la boutique. Accessible uniquement aux admins (`users.role = 'admin'`).

## Stack

| Couche | Techno |
|--------|--------|
| Framework | React 18 + TypeScript |
| Routing | React Router DOM |
| Build | Vite 5 |
| Backend | Supabase (même instance que explore-web) |
| Styles | CSS global (`index.css` + `App.css`) — thème parchemin |
| Déploiement | Netlify CLI manuel |

## Commandes

```bash
pnpm --filter hub dev     # Lance le Hub (port 3001)
pnpm --filter hub build   # Build
cd apps/hub && netlify deploy --prod --dir "%CD%\dist" --no-build
```

## Conventions

- **Pattern SaveBar** : toutes les pages utilisent `<SaveBar>` pour sauvegarder. Pas d'auto-save (sauf AssignFragments).
- **Après chaque save** : refetch les données du serveur pour garantir la synchronisation.
- **Deep copy** : `JSON.parse(JSON.stringify(data))` pour comparer l'état sauvé vs courant.
- **try/finally** : wrapper les fetch pour éviter les "Chargement..." infinis.
- **Classes CSS** : Publicités = `pub-*` (pas `ads-*`) pour éviter les ad blockers.

## Architecture

```
src/
├── App.tsx              # Router principal + auth guard
├── App.css              # Layout global
├── index.css            # Thème parchemin (palette, inputs, scrollbar)
├── hooks/
│   └── useAuth.ts       # Auth Supabase + vérification rôle admin
├── lib/
│   └── supabase.ts      # Client Supabase
└── components/
    ├── Sidebar.tsx            # Navigation latérale
    ├── SaveBar.tsx            # Barre save/annuler réutilisable
    ├── LoginPage.tsx          # Login OTP admin
    ├── Dashboard.tsx          # Vue d'ensemble
    │
    │── CONTENU
    ├── Users.tsx              # Gestion joueurs (lignes cliquables → UserDetail)
    ├── UserDetail.tsx         # Fiche joueur : infos, fragments, purchase_log, debug Shopify
    ├── Photos.tsx             # Photos communauté
    ├── PhotoSubmit.tsx        # Page publique soumission photos
    ├── Reviews.tsx            # Avis soumis
    ├── ReviewSubmit.tsx       # Page publique soumission avis
    ├── PublicForm.css         # Styles pages publiques
    │
    │── LA CARTE
    ├── TagsManager.tsx        # Tags de lieux (nom, icône, couleur, base_cost)
    ├── Factions.tsx           # Héritages (description, bannière, bonus énergie, réductions par tag)
    ├── Constructions.tsx      # Types de fortification
    ├── TitlesManager.tsx      # Titres du jeu
    ├── Fragments.tsx          # Fragments boutique (bonus passifs + compétences actives)
    ├── AssignFragments.tsx    # Attribution fragments → joueurs (mode stand)
    ├── ShopifyUnlocks.tsx     # Liens Shopify → fragments
    ├── Ads.tsx                # Loading screen (images + tips)
    ├── Settings.tsx           # Réglages (énergie, regen, distance, noms territoires)
    └── Divers.tsx             # Outils divers
```

## Pages et ce qu'elles gèrent

### Tags (`/carte/tags`)
- CRUD des tags de lieux
- `base_cost` : coût en énergie pour découvrir/veiller un lieu de ce type
- Nombre de lieux par tag affiché
- Suppression uniquement si aucun lieu n'utilise le tag

### Héritages / Factions (`/carte/factions`)
- Description, image (bannière), couleurs
- **Bonus énergie** : max + regen %
- **Réductions de coût par tag** : chaque héritage a un % de réduction par type de lieu
- Baroud d'Honneur : toggle ON/OFF + multiplicateur

### Constructions (`/carte/constructions`)
- 4 niveaux de fortification (Tour de guet → Forteresse)
- Nom, coût, bonus défense, description

### Titres (`/carte/titres`)
- Titres généraux (stats) + titres de faction
- Nom, icône (emoji), icon_url (image), description, condition (JSONB), ordre

### Fragments (`/carte/fragments`)
- Nom, description, images (icône ronde + grande image)
- **Bonus passif** : type (max_energy, regen_energy, etc.) + valeur
- **Compétence active** : type + cooldown (heures) + valeur (% pour discount)
- Types de compétence : free_discover, free_claim, double_glory, distance_ignore, discount_discover, discount_claim
- Mots de titre associés
- Toggle visible/invisible, lien boutique

### Associer Fragments (`/carte/associer`)
- Recherche joueur par nom, attribution instantanée
- Mode pending pour les emails sans compte (purchase_log)

### Publicités (`/carte/publicites`)
- Images du loading screen + tips "Le Saviez-vous ?"

### Réglages (`/carte/reglages`)
- **Titres de territoire** : termes par taille (Village/Ville/Capitale)
- **Cycles de régénération** : heures par point d'énergie
- **Énergie par défaut** : max pour tous les joueurs
- **Seuils de distance** : km pour les multiplicateurs

## Routes publiques (sans auth)

| Route | Composant |
|-------|-----------|
| `/soumettre-contenu` | PhotoSubmit |
| `/soumettre-avis` | ReviewSubmit |

## Intégration Shopify — État actuel

### Ce qui est fait ✅
- **OAuth** : connexion Hub ↔ Shopify via `ShopifyConnect.tsx` (token stocké dans app_settings)
- **Proxy API** : `netlify/functions/shopify-proxy.ts` — proxy toutes les requêtes Shopify Admin API
- **Sync initiale** : `netlify/functions/shopify-sync.ts` — 4343 clients Shopify importés dans Supabase (paginé, batch inserts)
- **Webhook orders/paid** : `netlify/functions/shopify-order-webhook.ts` — crée profil + attribue fragments à l'achat (1 purchase_log par fragment : unlocked/skipped/no_match/no_tags avec debug info)
- **UserDetail** : `UserDetail.tsx` — fiche joueur complète (fragments, purchase_log, Shopify Unlocks mappings) accessible depuis Users.tsx
- **App → Shopify** : `netlify/functions/shopify-create-customer.ts` — crée un client Shopify quand un joueur s'inscrit, avec tags `app-player` + `heritage-{faction}`
- **Vue utilisateurs enrichie** : `Users.tsx` avec colonnes Source (App/Shopify/Les deux), Statut, rétention, filtres
- **account_source** : `'app'` = inscrit via l'app, `'shopify'` = venu via achat. Ne change PAS quand on sync vers l'autre plateforme.
- **Crossover emails** : `ShopifySync.tsx` montre les emails présents sur les deux plateformes

### Netlify Functions (8)
| Fonction | Route | Rôle |
|----------|-------|------|
| `shopify-callback.ts` | `/.netlify/functions/shopify-callback` | OAuth code→token (server-side, contourne CORS) |
| `shopify-proxy.ts` | `/.netlify/functions/shopify-proxy` | Proxy Shopify Admin API depuis le frontend |
| `shopify-sync.ts` | `/.netlify/functions/shopify-sync` | Import initial des clients Shopify → Supabase |
| `shopify-order-webhook.ts` | `/.netlify/functions/shopify-order-webhook` | Webhook orders/paid → profil + tags source + fragments (via GraphQL) |
| `shopify-create-customer.ts` | `/.netlify/functions/shopify-create-customer` | App → Shopify : crée/met à jour le client avec tags `app-player`, `source:app`, `heritage-{faction}` |
| `shopify-sync-tags.ts` | `/.netlify/functions/shopify-sync-tags` | Met à jour les tags d'un client Shopify existant (appel unitaire depuis Users.tsx) |
| `shopify-batch-tags.ts` | `/.netlify/functions/shopify-batch-tags` | Batch update tags via GraphQL (25 clients/requête, utilisé par ShopifySync.tsx) |

### Tags Shopify gérés automatiquement
| Tag | Signification | Quand il est posé |
|-----|---------------|-------------------|
| `app-player` | Le client a un compte sur l'app | Inscription app |
| `source:app` | Canal d'acquisition = l'app | Inscription app |
| `source:shopify` | Canal d'acquisition = boutique en ligne | Premier achat (nouveau client) |
| `heritage-{faction}` | Héritage/faction du joueur | Inscription ou changement de faction |

**Règle clé :** une seule source par client (canal d'acquisition, immuable). Pour les clients "both", le plus ancien gagne.

### Helpers frontend
| Fichier | Rôle |
|---------|------|
| `src/lib/shopifyTags.ts` | `computeSourceTag()` + `syncUserTagsToShopify()` — calcul et push des tags |

### OAuth Scopes requis
`read_customers, write_customers, read_orders, read_products`

Le scope `read_products` est nécessaire pour que le webhook lise les tags des produits commandés (GraphQL).

### Ce qui reste à faire 🔜
1. ~~**Shopify Unlocks — tagger les produits**~~ ✅ Fait — mappings dans ShopifyUnlocks, webhook lit les tags produit via GraphQL
2. ~~**Tester le flow Unlocks**~~ ✅ Fait — fonctionne (1er avril 2026)
3. **Consent marketing** : tracking opt-in/out dans le Hub
4. **Gloire (Settings)** : taux découverte/veille/fortification + bonus coût % configurables
5. **Page /compte** (futur) : historique achats, fragments possédés, récompenses fidélité
