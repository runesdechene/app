# Intégration Shopify — Hub

## Ce qui est fait ✅

- **OAuth** : Hub ↔ Shopify via `ShopifyConnect.tsx` (token dans app_settings)
- **Proxy API** : `netlify/functions/shopify-proxy.ts`
- **Sync initiale** : 4343 clients importés (paginé, batch)
- **Webhook orders/paid** : crée profil + attribue fragments (1 purchase_log par fragment)
- **App → Shopify** : crée client Shopify à l'inscription app (tags `app-player` + `heritage-{faction}`)
- **UserDetail** : fiche joueur complète (fragments, purchase_log, Shopify Unlocks)
- **Users.tsx** : colonnes Source, Client, Statut, filtres
- **account_source** : `'app'` ou `'shopify'` uniquement (CHECK, immuable)
- **Dashboard** : stats croissance jour/7j/30j

## Netlify Functions (7)

| Fonction | Rôle |
|----------|------|
| `shopify-callback.ts` | OAuth code→token |
| `shopify-proxy.ts` | Proxy Shopify Admin API |
| `shopify-sync.ts` | Import initial clients → Supabase |
| `shopify-order-webhook.ts` | Webhook orders/paid → profil + fragments (GraphQL) |
| `shopify-create-customer.ts` | App → Shopify : crée client avec tags |
| `shopify-sync-tags.ts` | Update tags client unitaire |
| `shopify-batch-tags.ts` | Batch update tags (25/requête, GraphQL) |

## Tags Shopify automatiques

| Tag | Quand |
|-----|-------|
| `app-player` | Inscription app |
| `source:app` / `source:shopify` | Canal d'acquisition (immuable) |
| `heritage-{faction}` | Inscription ou changement faction |

## Helper frontend
`src/lib/shopifyTags.ts` — `computeSourceTag()` + `syncUserTagsToShopify()`

## OAuth Scopes
`read_customers, write_customers, read_orders, read_products`

## Reste à faire
- Consent marketing (opt-in/out tracking)
- Sync périodique (pas de cron récurrent)
