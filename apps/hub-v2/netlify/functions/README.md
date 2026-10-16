Les fonctions Netlify du Hub : celles de l'ancien Hub, déménagées. Code serveur repris tel quel,
sauf les trous de sécurité refermés dans les copies (plan 4, R2). Hors du lint et du `tsc` du Hub.
`../securite.test.ts` (hors de ce dossier, qui est déployé) teste les garde-fous (`fetch` simulé). En local elles ne tournent pas : tester
en ligne. L'appel côté client passe par `appelerFonction` (`src/shared/lib/fonctions.ts`),
sauf `flyer-create-account`, appelée sans session par `/flyercadeau` (`src/public/cadeau/api.ts`).

| Fonction | Rôle · qui l'appelle | Garde |
| --- | --- | --- |
| `shopify-proxy` | relais de l'API Shopify Admin (`?endpoint=`), boutique fixe · écrans Boutique et Photos | admin |
| `shopify-sync` | liaison comptes ↔ clients Shopify, boutique fixe · écran Synchro Shopify | admin |
| `shopify-sync-tags` | met à jour les étiquettes d'un client Shopify · écran Comptes | admin |
| `shopify-batch-tags` | idem par lots de 25 (GraphQL) · écran Synchro Shopify | admin |
| `shopify-article` | article de blog Shopify · écran Fiches | admin |
| `shopify-health-check` | santé du jeton et des portées Shopify · écran Santé | admin |
| `stand-create-account` | compte du stand · écran Associer un Fragment | admin |
| `shopify-callback` | échange le code OAuth contre un jeton (affiché, à copier à la main), boutique fixe · redirection Shopify | publique (sans code : 400) |
| `shopify-order-webhook` | webhook `orders/paid` : profil et Fragments · Shopify | signature HMAC obligatoire |
| `flyer-create-account` | un e-mail contre le code promo `FLYER_PROMO_CODE` : client Shopify (boutique fixe) et compte de l'appli · page `/flyercadeau` | publique : 15 demandes par heure et par IP (`flyer_signup_log`), sinon 429 ; aucune erreur ne renvoie l'e-mail ni le texte de Shopify ou de Supabase |

Variables d'environnement lues (sans aucune valeur ici) : `VITE_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_CLIENT_ID`,
`SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP`, `FLYER_PROMO_CODE` (`flyer-create-account`, qui lit aussi
`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `SHOPIFY_ACCESS_TOKEN`).

Le webhook `orders/paid` de Shopify pointe vers `hub.runesdechene.com` : il suit le domaine, passé au Hub V2 le 16/10.
`shopify-create-customer` ne déménage pas (spec §3) ; `flyer-create-account` a déménagé au plan 5, avec `/flyercadeau`.
