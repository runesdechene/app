# La bascule — la V2 prend la racine d'app.runesdechene.com

> Validé avec Uriel le 07/10/2026 (jour J). Remplace, pour l'adresse, la décision du 01/10
> (« Explore à `/explore` ») et précise la décision 001 (`docs/v2/decisions/001-app-separee.md`).

## Décisions

- **Coupure nette.** Le jour de la bascule, toute adresse de la V1 mène à la V2 (l'écran
  équivalent quand il existe). Pas de V1 en sursis. `apps/explore-web` est supprimée le lendemain.
- **Explore à la racine** `app.runesdechene.com/`, plus `/explore`. Raison : le service worker de
  la V2, servi à `/sw.js` avec la portée `/`, **remplace** celui de la V1 sur les téléphones —
  les abonnements push survivent, la V1 en cache disparaît, les vieux liens `/carte`, `/accueil`
  marchent tels quels. Le Campement viendra à `/campement`.
- **Le push suit la cloche de la V2** : ce qui touche tes lieux et toi, les mentions, les
  Compagnies, les Nouveautés. Les types V1 sans écran V2 (énigme du jour, expéditions, articles,
  Cour) s'arrêtent ; l'énigme du jour reviendra avec son chantier.

## Ce que l'inventaire du 07/10 a trouvé (et que rien ne prévoyait)

- Le push ne passe que par le service worker de la V1 (`apps/explore-web/src/sw.ts`, portée `/`).
  La V2 n'a ni gestionnaire `push` ni abonnement.
- Le service worker V1 resterait installé et servirait la V1 en cache.
- `apps/explore-web/netlify.toml` porte tout le domaine : `/lieu/*`, `/sitemap.xml`, `/mouvement`
  (seo-pages), l'en-tête `frame-ancestors` (l'appli dans la boutique Shopify).
- Les images des e-mails (`email-banner.jpg`, `email-logo.png`) et du tutoriel (`/res/tuto-*`)
  sont servies par la V1 ; les e-mails déjà envoyés les chargent à cette adresse.
- La V2 renvoie à la V1 qui n'a pas de session (`AccessGate`, `V1_URL = '/'`) ; elle confie la
  copie de l'e-mail changé (`USER_UPDATED`) à la V1.
- Liens d'invitation des Compagnies `/?company=<public_slug>` déjà partagés.

## 1. Où vit la V2

- **Même site Netlify que la V1 aujourd'hui** (`runesdechene`, ID `1b29da09-…`) : il porte le
  domaine et son certificat ; on y déploie le `dist` de la V2. Pas de changement de DNS ni de
  domaine. Le site `rdc-web-v2` ne sert plus après la bascule (à supprimer plus tard).
- La V2 passe à la racine : `base: '/'`, `basename` retiré, PWA `scope: '/'`,
  `start_url: '/accueil'`, `id` du manifeste fixé ; `index.html` perd ses `/v2` (canonique,
  `og:url`, `og:image`, JSON-LD) ; `FeuillePartager`, le lien du Hub `Signalements.tsx:22`.
- `apps/web-v2/netlify.toml` reprend les règles de la V1 : en-tête `frame-ancestors`, `/lieu/*`,
  `/sitemap.xml`, `/mouvement` vers seo-pages, puis le repli SPA. `/_astro/*` ne revient pas
  (seo-pages n'est plus en Astro). `public/_redirects` disparaît au profit du `netlify.toml`.
- `apps/web-v2/public/` reprend : `robots.txt` (avec `Sitemap:`), `email-banner.jpg`,
  `email-logo.png`, `res/tuto-*.svg`.

## 2. Les vieilles adresses

Redirections Netlify (301), dans `apps/web-v2/netlify.toml` :

| V1 | V2 |
|---|---|
| `/post-login` | `/accueil` |
| `/chat` | `/messages` |
| `/activite` | `/accueil/chemins` |
| `/nouvelles`, `/article/*` | `/accueil/nouveautes` |
| `/carte?placeId=:id` | `/carte/lieu/:id` |
| `/v2/*` | `/:splat` |

- `/?company=<public_slug>` : l'appli lit le paramètre au démarrage et ouvre la fiche de la
  Compagnie (`factions.public_slug` → id, par une petite RPC ou `compagnies()`).
- Sans session : `AccessGate` envoie à `/bienvenue` (plus à la V1). Le lien « Revenir à la V1 »,
  le cookie `explore_version`, `ancienneExplore.ts` et l'accès V2 (`has_v2_access`) disparaissent.
- `/bienvenue` servie en HTML pour Google (spec à part, même journée si le temps le permet).

## 3. Service worker et push

- vite-plugin-pwa passe en **`injectManifest`** avec `src/sw.ts` (V2) : précache, repli de
  navigation sur `index.html` **en liste blanche** — seulement les adresses d'Explore (`/`,
  `/accueil`, `/carte`, `/messages`, `/compagnies`, `/compte`, `/bienvenue`, `/da`) ; tout le
  reste va au serveur (voir « Les autres applis du domaine »),
  `skipWaiting` + `clientsClaim` (règle `v2.md`), gestionnaires `push` et `notificationclick`
  (ouvre ou focalise l'appli sur l'URL du push). Fichier servi à `/sw.js` : même adresse et même
  portée que la V1, donc il la remplace et garde ses abonnements.
- **Abonnement** dans la V2 : Préférences → « Notifications sur ce téléphone » (permission,
  `pushManager.subscribe` avec la clé VAPID publique, enregistrement par les RPC existantes
  `register_push_subscription` / `unregister_push_subscription`, migration 147). Les réglages
  `push_important_enabled` / `push_recap_enabled` restent.
- **`send-push`** : `categories.ts` et `payloads.ts` connaissent les types V2
  (`_notification_v2`, migration 421) avec le lien de `cibleDe` (`Notifications.tsx`) — la fiche
  du lieu, la fiche de la Compagnie, `/messages` pour une mention. Les types V1 sans équivalent
  deviennent `silent`.
- **Nouveautés** : un push à chaque publication (`publier_mise_a_jour`) vers
  `/accueil/nouveautes`, comme les Annonces (migration 220) : une notification de type
  `mise_a_jour` par joueur qui a un abonnement et `push_important_enabled` ; le déclencheur de la
  migration 142 envoie le push. La cloche ne la montre pas (`_notification_v2` ne la connaît pas :
  la Nouveauté y est déjà) ; l'e-mail (`email_on_notification`) doit l'ignorer — à vérifier dans
  sa liste. Une modification (`modifier_mise_a_jour`) ne renvoie rien.
- **`USER_UPDATED`** : la V2 recopie l'e-mail changé dans `users.email_address` comme la V1
  (`useAuth.ts:37-43`).

## Les autres applis du domaine — `/campement`, `/scan`

Explore à la racine ne doit jamais avaler un futur sous-dossier (Uriel, 07/10).

- **Préfixes réservés**, qu'Explore n'utilise jamais pour ses écrans : `/campement`, `/scan`,
  `/lieu`, `/mouvement`, `/sitemap.xml`, `/sw.js`. (`/scan` : le scan vit sur l'accueil du
  Campement, décision du 07/10 ; réservé par prudence.)
- **Netlify** : la première règle qui correspond gagne. Les règles des préfixes réservés sont
  écrites **avant** le repli SPA d'Explore. `/campement/*` et `/scan/*` y figurent dès la bascule,
  en commentaire tant que leur site n'existe pas — le jour venu, on décommente.
- **Service worker** : liste blanche (§3). Un sous-dossier qui n'est pas d'Explore va au serveur,
  sans qu'on touche à Explore.
- **Le Campement est une seconde porte de la même appli** (Uriel, 07/10) : même code, même
  service worker, mêmes droits ; seuls changent le manifeste (nom, icône, `id`, portée
  `/campement/`), l'onglet d'entrée, l'ordre des onglets et l'accueil. Explore donne accès au
  Campement et le Campement à Explore, dans la même fenêtre — pas de passage d'une appli à l'autre.
  Règle de construction : **les droits suivent la personne (Porteur), pas la porte** ; une porte
  n'est qu'un fichier de réglages. Spec propre au Campement, plus tard. Pour la bascule : réserver
  `/campement/` (Netlify et liste blanche), rien d'autre.
- `/scan` : le scan vit sur l'accueil du Campement ; réservé par prudence.
- **Le routeur d'Explore** : sa route `*` → `/accueil` ne voit jamais `/campement` (Netlify et le
  service worker l'ont déjà orienté ailleurs) ; un test le vérifie sur la liste blanche.

## 4. Le jour J, dans l'ordre

1. **Préalables, livrés sous `/v2` pendant que la V1 tourne** : push (service worker V2 encore
   en portée `/v2/`, testé sur un téléphone), `/?company=`, `USER_UPDATED`, fichiers déménagés.
2. **Préparation de la racine** dans une branche, sans déployer : `base`, portée, `netlify.toml`,
   redirections, `index.html`. Build, `vite preview`, parcours dans le navigateur.
3. **Bascule** (Uriel lance) : build racine, `netlify deploy --prod` sur le site `runesdechene`
   depuis `apps/web-v2`. Dans Supabase → Auth → URL : Site URL `https://app.runesdechene.com`,
   redirections sans `/v2/`.
4. **Vérification en prod** : `/`, `/bienvenue`, `/carte/lieu/<id>`, `/lieu/<slug>` (seo),
   `/sitemap.xml`, `/v2/accueil` → `/accueil`, `/carte?placeId=` ; console ; `sw.js` = celui de la
   V2 ; un téléphone qui avait la V1 installée s'ouvre sur la V2 ; un push de test arrive.
5. **Le jour même, en base** (migration) : couper les gains de Couronnes ; retirer l'INSERT direct
   de la V1 dans le chat (`chat_insert_*`) ; retirer `has_v2_access`. Les crons des énigmes
   restent (les énigmes reviennent dans la V2).
6. **Le lendemain** : supprimer `apps/explore-web`, les scripts racine qui la ciblent
   (`package.json`, `sync-app-version.mjs`), `cert-check.yml` à revoir, puis la purge de
   `docs/v2/purge-back.md`.

## Retour arrière

Netlify garde le déploiement précédent du site `runesdechene` (la V1) : un clic le republie. Le
service worker de la V2 serait alors remplacé à son tour par celui de la V1 (même `/sw.js`).

## Hors périmètre

`/campement` et le scan ; la purge de la base au-delà du jour J ; l'énigme du jour.
