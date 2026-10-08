---
paths:
  - "netlify.toml"
  - "package.json"
  - "**/*.config.*"
  - "supabase/functions/**"
---

# Déploiement, envois, notifications

> Tout ce qui sort de la machine : Netlify, e-mails, push.
> Regroupé le 25/09/2026 depuis la mémoire locale de Claude, pour que ce savoir
> voyage avec le dépôt au lieu de rester sur une seule machine.

## Sites Netlify et cycle de déploiement

Une machine fraîche n'a pas de `netlify link` (interactif) : toujours passer `--site <SITE_ID>`.

| Site | SITE_ID | Domaine |
|---|---|---|
| `runesdechene` (Explore, `apps/web-v2` depuis la bascule du 07/10/2026) | `1b29da09-c7af-44bf-9c31-465bfaae9d74` | `app.runesdechene.com` |
| `hub-runesdechene` | `d1cac03c-19a1-4b92-be72-fa3805428cd1` | `hub.runesdechene.com` |
| `rdc-seo-pages` | `5a5b9cb9-d330-41d7-a037-6bd65ac67eb9` | sert `/lieu/*` via rewrite |
| `runesdechene-demo` (borne) | `01d23d77-db08-4ecd-a0b6-f2b76035deb6` | `demo.runesdechene.com` — **abandonnée le 26/09/2026**, branche `demo-borne` supprimée : ne plus déployer |

- **Vérifier** : la page sert le build local (`curl -s https://app.runesdechene.com/ | grep -o
  'assets/index-[^"]*\.js'` = celui de `apps/web-v2/dist/index.html`), `curl -s …/sw.js | grep
  showNotification`, puis la version affichée dans le navigateur (deux rechargements).
- **Rollback éprouvé** : `git revert HEAD --no-edit`, rebuild, redeploy. Ou rollback Netlify en un clic.
- **Build Netlify** : pnpm 10 bloque le post-install d'esbuild → `onlyBuiltDependencies` +
  `packageManager` dans le `package.json` racine. Ne pas les retirer.

## Explore se déploie depuis `apps/web-v2`, sur le site `runesdechene`

Depuis la bascule (07/10/2026, spec `docs/superpowers/specs/2026-10-07-v2-bascule-design.md`),
la V2 **est** `app.runesdechene.com`. Ses règles (seo-pages, vieilles adresses V1, `/v2/*`, en-tête
pour la boutique) vivent dans `apps/web-v2/netlify.toml`, que la CLI ne lit que dans le dossier
courant : déployée d'ailleurs, l'appli partirait sans elles (piège du 05/10 avec la V1).

**How to apply :** `pnpm build` dans `apps/web-v2`, puis `cd apps/web-v2 && npx netlify-cli deploy
--prod --no-build --dir="<chemin absolu>/apps/web-v2/dist" --site=runesdechene` (le nom ; en cas de
« Not Found », l'identifiant). Vérifier ensuite `/lieu/<slug>` → 200, `/v2/accueil` → 301 vers
`/accueil`, `/v2/sw.js` → 200 (le service worker qui retire l'ancienne inscription de `/v2/`).
Puis **annoncer la version** : `node scripts/sync-app-version.mjs` (écrit `app_settings.explore.version`
depuis `apps/web-v2/package.json`, avec `SUPABASE_SERVICE_ROLE_KEY` du `.env`). Sans elle, la
fenêtre « Une nouvelle version d'Explore est arrivée » ne force rien : seuls les téléphones dont
le service worker a vu la mise à jour la proposent.

## Le Hub : `--site=<ID>` et `--no-build`, jamais son nom

**Le piège** (07/10/2026) : `--site=hub-runesdechene` sans `--no-build` lance un build Netlify qui
répond « Failed retrieving site data … Not Found ». Avec l'identifiant et `--no-build`, c'est passé :
`npx netlify-cli deploy --prod --no-build --dir "<abs>/apps/hub/dist" --functions
"<abs>/apps/hub/netlify/functions" --site=d1cac03c-19a1-4b92-be72-fa3805428cd1` (build fait avant,
`pnpm build` dans `apps/hub`). Pour la V1 c'est l'inverse (le nom passe, l'identifiant non) : en cas
de « Not Found », essayer l'autre forme.

## Netlify : créer un site, écrire une redirection

**Monorepo** : dans le dépôt, `netlify sites:create` (et d'autres commandes) ouvre un choix
interactif du projet et plante sans terminal. Créer un site par l'API, hors du dépôt :
`npx netlify-cli api createSiteInTeam --data '{"account_slug":"uriellahoussaye","body":{"name":"…"}}'`.

**Redirections Netlify : la barre finale ne compte pas.** Une règle `from = "/v2"` attrape aussi
`/v2/` : « /v2 → /v2/ » en 301 bouclait sur elle-même (30/09/2026, `/v2/` inaccessible juste
après le premier déploiement). Vérifier toute nouvelle redirection avec
`curl -sL -o /dev/null -w "%{http_code} %{num_redirects}" <url>`.

## V2 : monter la version avant chaque déploiement

La V2 affiche « Pythéas 1.0.0 » en bas de sa barre (et en bas des Préférences sur mobile) : Uriel
s'en sert pour savoir que le déploiement est arrivé (01/10/2026). Le numéro vient de
`apps/web-v2/package.json` (`version`), posé au build par Vite (`__VERSION__`).

**How to apply :** avant chaque `netlify deploy` de la V2, monter `version` — le dernier chiffre pour
une correction (1.0.1), celui du milieu pour une fonctionnalité (1.1.0) — puis `pnpm build`, puis
déployer. Le nom (Pythéas) vaut pour toute la 1.x ; une grande refonte change de nom et de premier
chiffre. Depuis 1.0.7, l'app cherche une nouvelle version toutes les heures et à chaque retour au
premier plan, et se recharge d'elle-même (`src/app/miseAJour.ts`) ; avant, l'app installée restait
coincée sur l'ancienne (Uriel, 01/10 : « toujours Pythéas 1.0.0 »).

## Netlify deploy — toujours chemin absolu

Toujours utiliser le chemin absolu pour `--dir` dans `netlify deploy`.

**Why:** Dans un monorepo pnpm, Netlify CLI résout `--dir=dist` depuis la racine du monorepo, PAS depuis le cwd. Ça plante à chaque fois. Déjà arrivé plusieurs fois et oublié à chaque fois.

**How to apply:** Quand on déploie avec `netlify deploy --prod`, toujours écrire le chemin complet :
```
npx netlify-cli deploy --prod --no-build --dir="C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages/dist" --site=<site-id>
```
Ne JAMAIS écrire `--dir=dist` seul.

**Spécifique au hub (et toute app avec Netlify Functions) :** `--no-build` upload uniquement le `--dir` et **ne bundle PAS les functions**. Si on déploie le hub avec `--no-build` seul, les functions sous `netlify/functions/` ne partent pas → SPA fallback `/* → /index.html` capture les calls vers `/.netlify/functions/*` → erreur "Unexpected token '<', is not valid JSON" côté frontend (HTML au lieu de JSON).

Pour le hub, **toujours** ajouter `--functions "$PWD/netlify/functions"` (chemin absolu) :
```
cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions"
```
Pour explore-web (pas de Netlify Functions), `--no-build` seul suffit. Apprentissage 2026-04-22.

## Limitations Web Push selon navigateur / mode (PWA RdC)

Tableau des comportements observés en testant le système push V1 RdC. À se rappeler avant de redire à un user que "ça marche" ou de re-débugger.

| Plateforme / mode | Activation | Push reçu | Click ouvre PWA standalone |
|---|---|---|---|
| **Chrome Android — PWA installée via "Installer l'application"** | ✅ | ✅ | ✅ |
| **Chrome Android — onglet navigateur** | ✅ | ✅ | ❌ ouvre Chrome navigateur |
| **Brave Android — "Ajouter à l'écran d'accueil"** | ✅ | ✅ | ❌ ouvre Brave (raccourci ≠ PWA) |
| **Chrome desktop incognito** | modale RdC s'affiche, **clic "Activer" ne fait rien** (Chrome bloque le 2e prompt natif en incognito) | n/a | n/a |
| **Chrome desktop normal** | ✅ | ✅ | ✅ si PWA installée |
| **iOS Safari hors standalone** | impossible (Web Push iOS = mode standalone obligatoire) | non | non |
| **iOS Safari mode standalone (PWA installée)** | non testé V1 | théorique ✅ | théorique ✅ |

**Pièges à mémoriser :**

- **Brave "Ajouter à l'écran d'accueil"** crée un raccourci, pas une vraie PWA. Pour avoir le mode standalone, il faut Chrome Android stock + menu "Installer l'application".
- **Chrome incognito** désactive silencieusement le prompt natif notification. La sub n'est jamais créée. Inutile de tester l'activation en incognito — uniquement la modale RdC visuelle.
- **`Notification.permission`** est OS-level, pas localStorage. "Clear data" PWA ne le reset pas. Pour reset complet, il faut Chrome → Site Settings → Reset & clear sur l'origin.
- **`syncSubscription`** au boot re-créera silencieusement une sub si `permission === 'granted'` + pas de sub locale. Sauf si flag `localStorage.push_user_disabled` set (timestamp 30j cooldown).
- **URLs de notif** doivent matcher le `start_url` du manifest (`/carte` pour RdC) sinon Android ouvre le navigateur au lieu de la PWA. Le SW custom normalise toute URL non-`/carte` automatiquement.

**Wording user-facing à éviter :** ne jamais dire "ça marche partout" — la fragmentation navigateur/OS est réelle. Préférer : "ça marche sur Chrome Android avec PWA installée et iPhone Safari standalone, et c'est notre cible principale".

## reference_email_resend_infra

Pour emailer des users de l'app Runes de Chêne :

- **Resend est câblé.** Clés en base dans `public.app_settings` : `resend_api_key`, `email_from` (= `Runes de Chêne <communaute@mail.runesdechene.com>`, domaine `mail.runesdechene.com` vérifié), `email_trigger_secret`. NE PAS hardcoder ces secrets dans un fichier versionné.
- **Edge function `supabase/functions/send-email`** : déclenchée par trigger SQL `email_on_notification` (after INSERT on `notifications`). **Verrouillée à 2 types** : `contribution_approved`, `crowns_awarded`, templates HTML en dur. Lit l'email sur **`users.email_address`** (pas `auth.users`). → ne sert PAS pour un mail ad hoc tel quel.
- **Pour un blast one-shot** (ex : récompense Coupe), écrire un petit script `.mjs` qui POST sur `https://api.resend.com/emails`, clé + from lus depuis l'env (jamais en dur). Charte HTML : bannière `app.runesdechene.com/email-banner.jpg` + logo `email-logo.png`, fond parchemin `#f7f1e3`/`#e1d1b2`, serif Georgia, doré `#8a6d3b`. Modèle déjà rendu dans `send-email/index.ts` (`renderCrownsAwarded`).
- L'email canonique d'un user = **`users.email_address`** (et `users.first_name` souvent NULL → fallback `display_name`, cf. [[reference_users_first_name_vs_display_name]]).

Première utilisation réelle : 23/06/2026 — récompense Coupe des Héritages aux 15 meilleurs Pèlerins des Brumes (faction-celtique), codes promo Shopify `COUPEPRINTEMPSHEROS` (−20 %, top 11) et `COUPEPRINTEMPS` (−10 %, >10 pts). Lié à [[project_maj_1_0_refonte_identite]].

## reference_envoi_email_resend_send_email

**L'app envoie les emails via Resend**, à travers l'Edge Function **`supabase/functions/send-email/index.ts`**.

- **Service** : Resend (`POST https://api.resend.com/emails`, body `{from, to, subject, html}`).
- **Config en DB** (`app_settings`) : `resend_api_key`, `email_from`, `email_trigger_secret`. La fonction les lit elle-même (rien en dur). Resend est en **mode production** (envoie à n'importe quelle adresse).
- **Sécurité** : la fonction exige le header `X-Email-Secret` = `email_trigger_secret`.
- **Déclenchement normal** : trigger SQL `email_on_notification` (AFTER INSERT ON `notifications`) → `pg_net.http_post` vers l'edge function. Donc INSÉRER une notification du bon type ⇒ email part.
- ⚠️ **TEMPLATE-LOCKED** : la fonction ne gère QUE deux types — `contribution_approved` et `crowns_awarded` — et **rend un HTML fixe** (templates parchemin codés dans le fichier). Tout autre `type` ⇒ `ok()` sans rien envoyer. **Elle ne sait PAS envoyer un sujet/HTML arbitraire.**

**Donc pour envoyer un email CUSTOM (marketing, fin de Coupe, etc.) :**
1. Ajouter un nouveau `type` + une fonction `renderXxx()` (HTML) dans `send-email/index.ts`.
2. Redéployer l'edge function (`pnpm dlx supabase functions deploy send-email` ou via MCP `deploy_edge_function`).
3. Le déclencher (insert notification de ce type, ou appel direct avec le `X-Email-Secret`).

**Gabarit HTML RdC** (réutiliser le style des templates existants) : table parchemin `#f7f1e3`, bannière `https://app.runesdechene.com/email-banner.jpg`, logo `https://app.runesdechene.com/email-logo.png`, titre serif, bouton doré `#8a6d3b`. Voir `renderCrownsAwarded` comme base.

**Règle d'envoi** : voir [[feedback_never_send_without_explicit_go]] — jamais d'envoi sans GO explicite isolé. Liens promo Shopify : `https://runesdechene.com/discount/CODE` applique le code automatiquement.

## L'edge function `send-push` se déploie toujours avec `--no-verify-jwt`

**Le piège** (08/10/2026) : le déclencheur `push_on_notification` appelle `send-push` avec le seul
en-tête `X-Push-Secret`, sans jeton. Un `supabase functions deploy send-push` sans l'option
réactive la vérification du jeton : la passerelle refuse alors tous les appels, et plus aucun push ne
part, sans erreur visible nulle part. Deux minutes ainsi le 08/10, rattrapées par un redéploiement.

**How to apply :** `npx supabase functions deploy send-push --use-api --no-verify-jwt` (`--use-api` :
sans Docker ; `--linked` n'existe pas pour cette commande). Vérifier ensuite
`curl -s -X POST <SUPABASE_URL>/functions/v1/send-push -d '{}'` → `unauthorized` (le refus de la
fonction elle-même, faute de secret) ; un JSON « Missing authorization header » veut dire que la
passerelle bloque encore.
