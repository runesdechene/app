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
| `runesdechene` (explore-web) | `1b29da09-c7af-44bf-9c31-465bfaae9d74` | `app.runesdechene.com` |
| `hub-runesdechene` | `d1cac03c-19a1-4b92-be72-fa3805428cd1` | `hub.runesdechene.com` |
| `rdc-seo-pages` | `5a5b9cb9-d330-41d7-a037-6bd65ac67eb9` | sert `/lieu/*` via rewrite |
| `runesdechene-demo` (borne) | `01d23d77-db08-4ecd-a0b6-f2b76035deb6` | `demo.runesdechene.com` — **abandonnée le 26/09/2026**, branche `demo-borne` supprimée : ne plus déployer |

- **Après chaque deploy explore-web** : `node scripts/sync-app-version.mjs` (lit `# X.Y.Z` en tête
  de `apps/explore-web/CHANGELOG.md`, écrit `app_settings.app.latest_version` → `UpdateBanner`).
  Requiert `SUPABASE_SERVICE_ROLE_KEY` dans le `.env`.
- **Vérifier** : `curl -s https://app.runesdechene.com/sw.js | grep -oE "matchPrecache|KILL_SWITCH"`.
- **Rollback éprouvé** : `git revert HEAD --no-edit`, rebuild, redeploy. Ou rollback Netlify en un clic.
- **Build Netlify** : pnpm 10 bloque le post-install d'esbuild → `onlyBuiltDependencies` +
  `packageManager` dans le `package.json` racine. Ne pas les retirer.

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
