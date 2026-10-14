Les fonctions Netlify du Hub V2 : celles de l'ancien Hub, déménagées. Code serveur repris tel quel,
sauf les trous de sécurité refermés dans les copies (plan 4, R2). Hors du lint et du `tsc` du Hub.
`securite.test.ts` teste les garde-fous (`fetch` simulé). En local elles ne tournent pas : tester
sur le site de préparation. L'appel côté client passe par `appelerFonction` (`src/shared/lib/fonctions.ts`).

| Fonction | Rôle · qui l'appelle | Garde |
| --- | --- | --- |
| `shopify-proxy` | relais de l'API Shopify Admin (`?endpoint=`), boutique fixe · écrans Boutique et Photos | admin |
| `shopify-sync` | liaison comptes ↔ clients Shopify, boutique fixe · écran Synchro Shopify | admin |
| `shopify-sync-tags` | met à jour les étiquettes d'un client Shopify · écran Comptes | admin |
| `shopify-batch-tags` | idem par lots de 25 (GraphQL) · écran Synchro Shopify | admin |
| `shopify-article` | article de blog Shopify · écran Fiches | admin |
| `shopify-health-check` | santé du jeton et des portées Shopify · écran Santé | admin |
| `stand-create-account` | compte du stand · écran Comptes | admin |
| `shopify-callback` | échange le code OAuth contre un jeton (affiché, à copier à la main), boutique fixe · redirection Shopify | publique (sans code : 400) |
| `shopify-order-webhook` | webhook `orders/paid` : profil et Fragments · Shopify | signature HMAC obligatoire |

Variables d'environnement lues (sans aucune valeur ici) : `VITE_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_CLIENT_ID`,
`SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP`.

Le webhook `orders/paid` de Shopify pointe encore vers l'ancien site ; il ne change qu'au plan 5.
`shopify-create-customer` ne déménage pas (spec §3) ; `flyer-create-account` part au plan 5, avec `/flyercadeau`.
