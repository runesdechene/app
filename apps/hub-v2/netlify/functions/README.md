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
| `shopify-client-webhook` | webhooks `customers/create` et `customers/update` : l'accord aux nouvelles suit Shopify (le plus récent gagne, `lib/accord.ts`), fiche créée pour un inscrit inconnu · Shopify | signature HMAC obligatoire |
| `missives-envoyer` | envoie les Missives programmées, un lot de 250 par réveil, par Resend (`lib/resend.ts`) ; lien de désabonnement signé (`lib/jeton.ts`) · `pg_cron` toutes les 5 min (`_reveiller_missives`, mig 541) | en-tête `X-Missives-Secret` = `MISSIVES_SECRET` |
| `missives-essai` | « M'envoyer un essai » : la Missive enregistrée part tout de suite à l'admin connecté, objet « [Essai] … » · écran Écrire | admin (`lib/admin.ts`) |
| `missives-desabonnement` | retire l'accord aux nouvelles (fiche puis Shopify) · page `/desabonnement` et le désabonnement en un clic des boîtes de réception (RFC 8058) | publique : jeton signé (`lib/jeton.ts`), sinon 400 sans rien écrire |
| `resend-webhook` | ouvertures, clics, rebonds et plaintes des Missives (`missive_envois`) ; un rebond ou une plainte retire l'accord · Resend | signature Svix, `RESEND_WEBHOOK_SECRET` |
| `flyer-create-account` | un e-mail contre le code promo `FLYER_PROMO_CODE` : client Shopify (boutique fixe) et compte de l'appli · page `/flyercadeau` | publique : 15 demandes par heure et par IP (`flyer_signup_log`), sinon 429 ; aucune erreur ne renvoie l'e-mail ni le texte de Shopify ou de Supabase |

Variables d'environnement lues (sans aucune valeur ici) : `VITE_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_CLIENT_ID`,
`SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP`, `FLYER_PROMO_CODE`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MISSIVES_SECRET` (`flyer-create-account`, qui lit aussi
`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `SHOPIFY_ACCESS_TOKEN`).

`lib/` n'est pas une fonction : les aides partagées (`accord.ts`, `admin.ts`, `jeton.ts`, `missive.ts`, `resend.ts`, signature Shopify dans `shopify.ts`).

Le webhook `orders/paid` de Shopify pointe vers `hub.runesdechene.com` : il suit le domaine, passé au Hub V2 le 16/10.
`shopify-create-customer` ne déménage pas (spec §3) ; `flyer-create-account` a déménagé au plan 5, avec `/flyercadeau`.
