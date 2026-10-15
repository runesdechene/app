# Hub V2 — plan 5 : Parler aux joueurs, Réglages, pages publiques, bascule

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** les derniers écrans du Hub V2 — Mises à jour, Notifications, Blog de la boutique, Réglages (texte de partage, image des pages SEO) —, les trois pages publiques des QR (`/soumettre-contenu`, `/flyer`, `/flyercadeau`) redessinées au style V2, puis la bascule de `hub.runesdechene.com` sur le nouveau site et le retrait de `apps/hub`.

**Architecture:** deux zones nouvelles sur les briques des plans 1-4 : `apps/hub-v2/src/features/joueurs/` (Mises à jour, Notifications, Blog) et `src/features/reglages/`. Les pages publiques vivent dans `src/public/` (une zone hors de la coquille et de la porte admin, avec ses propres briques de formulaire) et sont montées dans le routeur **avant** `PorteDEntree`. La fonction `flyer-create-account` déménage dans `apps/hub-v2/netlify/functions/`. Explore lit le texte de partage dans `app_settings`. La bascule est une suite d'étapes manuelles, chacune vérifiée, faites par le contrôleur avec Uriel.

**Tech Stack:** celle des plans 1-4 + `marked` 15 et `dompurify` 3 (rendu du Markdown du blog, mêmes versions majeures que l'ancien Hub — vérifier dans `apps/hub/package.json` avant d'ajouter).

**Spec:** `docs/superpowers/specs/2026-10-14-hub-v2-design.md` — §3 (les trois adresses publiques ne changent pas ; `flyer-create-account` déménage), §5 (menu « Parler aux joueurs », « Réglages »), §11 (tri : mises à jour, notifications repris ; Réglages = texte de partage seul ; accueil V1 = image des pages SEO seule ; annonces = blog de la boutique seul ; modèles d'écran), §12.5-6 (webhook repointé, bascule, retrait de l'ancien Hub, `hub.md` réécrit).

## Global Constraints

- Tout ce que disent les plans 1 à 4 (Global Constraints) vaut ici : worktree **hors du dépôt** (`C:\Users\uriel\Desktop\DEVs\hub-v2-parler`, branche `feat/hub-v2-parler` partie de `main` — les plans 2, 3, 4 y sont fusionnés le 15/10), **casse exacte du chemin, y compris pour `pnpm install`** (`.claude/rules/deploiement.md`, piège du 15/10) ; TS strict sans `any`, `@ts-ignore`, `as unknown as` ; jetons seulement (Stylelint) ; en-têtes QUOI/POURQUOI ; README par dossier ; composant → hook → api ; tout état navigable est une URL ; animations par les jetons, `prefers-reduced-motion` ; pas de `console.log` ; pas de `window.confirm` (confirmation en ligne : « … ? » Confirmer / Annuler) ; ESLint `max-lines` 400 ; Conventional Commits + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Migration **522** (une seule ; numéro reconfirmé à la Task 2). Écrite, vérifiée dans une transaction annulée, **jamais appliquée par l'exécutant** : le contrôleur la fait appliquer avec l'accord d'Uriel (`npx supabase db push --linked` après `--dry-run`), puis régénère les types.
- **Ne pas toucher** aux RPC anonymes lues par le thème Shopify (liste du plan 4) ni à `deposer_contenu`, `get_studio_config` (anon, mig 494) : les pages publiques les appellent telles quelles.
- **Les trois adresses publiques ne changent pas** (imprimées sur des QR) : `/soumettre-contenu` (avec `?quete=<slug>`), `/flyer`, `/flyercadeau`, chacune servie aussi avec une barre finale. Leur contenu et leurs étapes restent ceux d'aujourd'hui ; seule l'apparence change (R1).
- Les pages publiques ne chargent **aucun** code du Hub admin (pas de requête à `hub_est_admin`, pas de coquille) et ne contactent aucun tiers (polices servies par `@runes/da/polices`, RGPD du 11/10).
- `hub.runesdechene.com` (ancien Hub) marche jusqu'à la Task 11 : aucun fichier de `apps/hub/` ne change avant.
- Vocabulaire : « contribution » (une soumission), « mise à jour » (une note de « Nouveautés »), « article » (un billet du blog Shopify), « Compagnie », « Explorateur ».
- Un enregistrement réussi rafraîchit ce qu'il touche (TanStack Query) ; une erreur s'affiche sous son bloc avec le message reçu ; jamais d'écran blanc.

## Décisions prises en écrivant le plan

- **R1** — Pages publiques : **redessinées au style V2** (Uriel, 15/10), sur maquette Figma validée avant le code (Task 1). Même contenu, mêmes étapes, mêmes appels qu'aujourd'hui ; téléphone d'abord (on y arrive par un QR), PC ensuite.
- **R2** — Texte de partage : **Explore le lit aussi** (Uriel, 15/10). `FeuillePartager` lit `app_settings.share_text_template` et remplace **chaque** `{name}` (`replaceAll`) ; repli sur la phrase actuelle d'Explore si la lecture échoue ou si la clé est vide. Les pages SEO passent aussi à `replaceAll`. La phrase en base aujourd'hui est « Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}. » : c'est elle que verront les joueurs au déploiement — Uriel la relit dans Réglages avant.
- **R3** — Image des pages SEO : une seule case, `landing_image_desktop_url` (le fond de `/mouvement`, seule clé lue, par `apps/seo-pages`). Les trois autres clés de l'ancien écran n'ont aucun lecteur : pas reprises. L'image change au prochain passage du workflow de la nuit ; l'écran le dit. Envoi dans `app-assets` par `envoyerFichier`, l'ancienne image retirée par `retirerFichier` **après** l'enregistrement de la nouvelle adresse.
- **R4** — Mises à jour : la liste et l'éditeur (titre ≤ 80, texte ≤ 3000, version ≤ 30, image), mêmes RPC (`publier_mise_a_jour`, `modifier_mise_a_jour`, `supprimer_mise_a_jour`, `mises_a_jour_publiees`). Chaque ligne montre aussi ses cœurs et ses mots (`coeurs`, `mots`, déjà rendus), en lecture. Publier envoie un push aux abonnés (mig 453) : le bouton le dit (« Publier et prévenir les joueurs »). Une image remplacée, retirée ou dont la note est supprimée quitte le bucket `announcement-covers` (l'ancien Hub les laissait orphelines).
- **R5** — Notifications : en lecture, comme l'ancien écran (trois chiffres, trois groupes, fil des 50 dernières), au modèle « tableau de bord ». Le catalogue (`DESCRIPTIONS`, `typesConnus`, `typesQuiPartent`, `catalogue`) est repris dans `features/joueurs/lib/catalogue.ts` et importe `categories.ts` et `payloads.ts` de `supabase/functions/send-push/` comme l'ancien Hub — **une seule source** pour ce qui part. Si ces deux fichiers ne passent pas le `tsc` du Hub V2 (options plus strictes), on les rend conformes **dans `send-push`** (ils restent valides pour Deno) plutôt que de les dupliquer.
- **R6** — Blog de la boutique : la liste des articles et l'éditeur (type, titre, couverture, texte en Markdown avec aperçu, bouton d'appel), « Publier sur la boutique » / « Mettre à jour l'article » par `shopify-article` (déjà copiée au plan 4), puis `set_announcement_channel(…, 'blog', 'published', article_id)`. **Plus besoin de « publier dans l'app » d'abord** : aucune appli ne lit plus `announcements` ; Push, Instagram, E-mail et « publier dans l'app » ne sont pas repris (morts, relevé du 15/10). L'appel et le bouton (`cta_url`, `cta_label`) sont ajoutés au corps HTML envoyé (l'ancien Hub les oubliait). Une couverture retirée est retirée de l'article (`image: null` dans le PUT — à ajouter dans la copie de `shopify-article`). **Le blog n'a jamais servi** (6 annonces, aucune sur le blog, la dernière le 26/06) : Uriel peut retirer cette tâche à la relecture sans toucher au reste.
- **R7** — Sur le téléphone, l'onglet « Plus » mène à `/reglages` ; l'écran Réglages y commence par les liens de « Parler aux joueurs » (montrés seulement sous la largeur du PC, container query comme la coquille), sinon ces écrans seraient hors d'atteinte.
- **R8** — `/soumettre-contenu` : la liste des missions publiées reste (une seule aujourd'hui, Hoplite ; `?quete=hoplite` encore servi le 25/07). Les images de fond viennent toujours de `get_studio_config` si la maquette les garde ; sinon la page n'appelle plus que `deposer_contenu` et la liste des missions.
- **R9** — `flyer_signup_log` (le frein du flyer, 15 inscriptions par heure et par IP) existe en prod sans migration : la 522 la déclare (`CREATE TABLE IF NOT EXISTS`, copiée de la définition live), comme le §13.1 l'a fait pour `account_source`.
- **R10** — La bascule (Task 11) déplace le domaine personnalisé de `hub-runesdechene` vers `rdc-hub-v2` dans Netlify, puis vérifie dans Shopify l'adresse du webhook `orders/paid` et l'adresse de retour OAuth : si elles visent `hub.runesdechene.com`, rien à changer ; si elles visent `hub-runesdechene.netlify.app`, Uriel les change dans l'admin Shopify. L'ancien site Netlify n'est supprimé qu'**avec l'accord d'Uriel**, après une journée sans incident et la rotation des clés.

## Review Focus

1. **Un QR scanné sur `/flyer/` ou `/soumettre-contenu/?quete=hoplite`** (barre finale, paramètres) → la page publique, jamais l'écran de connexion de l'équipe. (Test : Task 6, routeur.)
2. **Un joueur connecté au Hub en admin qui ouvre `/soumettre-contenu`** → la page publique, sans la coquille ; un visiteur sans session → pareil, aucune requête `hub_est_admin`. (Test : Task 6.)
3. **Un envoi de contribution dont un fichier échoue** (réseau, 15 Mo dépassés, vidéo de 60 Mo) → le fichier refusé est nommé avant l'envoi ; un échec réseau partiel n'empêche pas l'envoi des autres, et si aucun ne passe, la page le dit et garde le formulaire rempli. (Test : Task 9.)
4. **Un texte de partage vide, absent ou sans `{name}`** → Explore partage sa phrase de repli ; un texte avec deux `{name}` → les deux remplacés. (Test : Task 5.)
5. **Supprimer une mise à jour ou changer son image** → l'ancien fichier quitte `announcement-covers` ; si le retrait du fichier échoue, la note reste supprimée et l'erreur s'affiche (la base d'abord, le fichier ensuite). (Test : Task 3.)

---

## Fichiers

```
supabase/migrations/522_flyer_signup_log.sql
supabase/functions/send-push/categories.ts, payloads.ts          (seulement si le tsc du Hub l'exige, R5)
apps/hub-v2/src/app/router.tsx, router.test.tsx                   (routes publiques, écrans faits, plus de BientotIci)
apps/hub-v2/src/app/coquille/BientotIci.tsx, .module.css          (supprimés, Task 10)
apps/hub-v2/src/features/joueurs/                                 (api, hooks, lib, components, README)
apps/hub-v2/src/features/reglages/                                (api, hooks, components, README)
apps/hub-v2/src/public/                                           (pages publiques : flyer, cadeau, soumettre ; briques ; README)
apps/hub-v2/public/                                               (images des pages publiques retenues par la maquette)
apps/hub-v2/netlify/functions/flyer-create-account.ts            (copié de apps/hub, Task 8)
apps/hub-v2/netlify/functions/shopify-article.ts                 (image retirée, R6)
apps/web-v2/src/features/lieu/components/FeuillePartager.tsx     (+ api/hook du texte de partage, R2)
apps/seo-pages/src/build.ts, templates/photo.ts                  (replaceAll, R2)
.github/workflows/cert-check.yml, CLAUDE.md, .claude/rules/*.md, docs/db/*.md, docs/tech-backlog.md   (Task 11)
apps/hub/                                                         (retiré, Task 11)
```

---

### Task 1: Maquettes Figma — les trois pages publiques et l'écran Réglages (validées par Uriel avant tout code)

**Fichiers :** aucun dans le dépôt. Fichier Figma « Runes de Chêne — App v2 », nouvelle section « Hub V2 — pages publiques (15/10) » à côté de « Hub V2 — maquette (14/10) ».

- [ ] Lire `.claude/rules/interface.md` et `.claude/rules/hub.md` (« Tout écran du Hub se conçoit »), puis les maquettes existantes (ouverture `587:761`, téléphone `597:1365`, Photos et avis `596:1319`) et les pages d'Explore les plus proches (`/bienvenue`, la porte d'entrée) : les pages publiques parlent à des joueurs, pas à l'équipe — elles empruntent à Explore plus qu'au Hub.
- [ ] Charger les skills `figma:figma-use` et `figma:figma-generate-design` ; chercher les composants et variables existants (`search_design_system`) avant d'en dessiner.
- [ ] Dessiner, à 390 px puis à 1440 px :
  - `/flyer` : logo et slogan, puis cinq liens (boutique, Explore, cadeau `/flyercadeau`, Instagram, Fellowship), dans cet ordre.
  - `/flyercadeau` : l'e-mail, la case « newsletter » (décochée), le bouton ; l'écran du code promo (le code, le lien `runesdechene.com/discount/<code>`, retour boutique, lien confidentialité) ; l'erreur (« trop d'essais », réseau).
  - `/soumettre-contenu` : les quatre étapes (1 fichiers ≤ 10 + mission ; 2 une taille par fichier XS–5XL ou « aucune » ; 3 message ≤ 500, deux notes de 1 à 5, note privée, département ; 4 prénom, e-mail, taille en cm, deux accords obligatoires), l'envoi en cours (fichier n sur N), le succès (couronnes de bienvenue si nouveau compte, lien vers Explore), l'échec.
  - `/reglages` : le texte de partage (aperçu avec « Abbaye de Fontenay »), l'image des pages SEO, et, sur le téléphone seulement, les liens « Parler aux joueurs » en tête (R7).
- [ ] Montrer à Uriel les captures (`get_screenshot`) ; noter ses retours ; recommencer jusqu'à « validé ». Écrire la décision dans `_État.md` du vault (une ligne, ids des nœuds).
- [ ] Relever les polices utilisées : si un poids manque à `packages/da/polices.ts` (Cabin Condensed 600 ?), l'ajouter à la Task 6, pas ailleurs.

**Livrable :** ids Figma des huit cadres (3 pages × 2 largeurs + succès/échec si séparés, Réglages × 2), validés.

---

### Task 2: Migration 522 — `flyer_signup_log` déclarée (écrite, vérifiée, **non appliquée**)

**Fichiers :** Create `supabase/migrations/522_flyer_signup_log.sql`

- [ ] Reconfirmer le numéro (`ls supabase/migrations | tail -1` sur `main` et sur les branches ouvertes).
- [ ] Lire la définition live : colonnes, défauts, index, RLS, politiques et droits de `public.flyer_signup_log` (`information_schema.columns`, `pg_indexes`, `pg_policies`, `information_schema.column_privileges` — la mig 337 retire `email` à anon et authenticated).
- [ ] Écrire la migration, en-tête `-- WHY: flyer_signup_log existe en prod sans migration (créée à la main pour le frein du flyer) ; le dépôt la déclare telle quelle (spec Hub V2 §13.1, même démarche que account_source).` : `CREATE TABLE IF NOT EXISTS` identique au live, `ENABLE ROW LEVEL SECURITY`, les index `IF NOT EXISTS`, les droits tels qu'en prod. Aucune donnée ne change.
- [ ] Vérifier : `BEGIN; \i 522…; ROLLBACK;` sur la base liée ne lève rien, et `npx supabase db push --linked --dry-run` ne liste que la 522.
- [ ] Commit `feat(db): flyer_signup_log déclarée dans le dépôt (mig 522, à appliquer)`.

---

### Task 3: Mises à jour — la liste et l'éditeur

**Fichiers :**
- Create `src/features/joueurs/api/misesAJour.ts`, `hooks/useMisesAJour.ts`, `components/MisesAJour.tsx`, `components/TiroirMiseAJour.tsx`, `components/Joueurs.module.css`, `components/MisesAJour.test.tsx`, `README.md`
- Modify `src/app/router.tsx` (route `joueurs/mises-a-jour` avec enfants `nouvelle` et `:id`, entrée dans `ECRANS_FAITS`)

**Interfaces :**
- `type MiseAJour = { id: number; titre: string; texte: string; quand: string; image: string | null; version: string | null; coeurs: number; mots: number }` — lu de `mises_a_jour_publiees()` (les autres champs ignorés).
- `lireMisesAJour(): Promise<MiseAJour[]>` · `publierMiseAJour(m: { titre; texte; image: string | null; version: string | null }): Promise<number>` · `modifierMiseAJour(id, m)` · `supprimerMiseAJour(id)`.
- `useMisesAJour()` (clé `['hub-mises-a-jour']`), `useEnregistrerMiseAJour()`, `useSupprimerMiseAJour()`.

- [ ] **Tests d'abord** (`MisesAJour.test.tsx`, client Supabase simulé comme dans `features/jeu`) :
  - la liste montre titre, date (`dateCourte`), version, « 3 cœurs · 1 mot » (`pluriel`) ;
  - le bouton reste inactif tant que le titre (rogné) n'a pas 1 à 80 signes et le texte 1 à 3000 ; le compteur dit « n / 3000 » ;
  - une nouvelle note : le bouton s'appelle « Publier et prévenir les joueurs » ; une note existante : « Enregistrer » ;
  - **remplacer l'image** : l'ancienne passe à `retirerFichier('announcement-covers', …)` après `modifier_mise_a_jour` réussie ;
  - **supprimer** : « Supprimer cette mise à jour ? » Confirmer → `supprimer_mise_a_jour` puis `retirerFichier` de l'image ; si `retirerFichier` rejette, la note a quitté la liste et l'erreur s'affiche (Review Focus 5) ;
  - une erreur de la base s'affiche sous le formulaire.
- [ ] Lancer : `pnpm vitest run src/features/joueurs` → échec attendu (modules absents).
- [ ] Écrire l'api (appels `supabase.rpc` aux quatre fonctions, erreurs relancées avec `messageDErreur`), les hooks (invalidation de `['hub-mises-a-jour']`), l'écran au modèle « Réglages (formulaire) » à gauche et la liste « Déjà publiées » dessous, le tiroir d'édition à son adresse (`/joueurs/mises-a-jour/:id`, `nouvelle`). Image : `verifierFichier` puis `envoyerFichier('announcement-covers', 'mise-a-jour-<Date.now()>.<ext>', f)` ; adresse publique gardée dans `image`. Le texte s'affiche avec `white-space: pre-wrap`, comme dans l'ancien Hub.
- [ ] Tests verts ; `pnpm lint` ; `pnpm build`.
- [ ] Commit `feat(hub-v2): les mises à jour — la liste et l'éditeur`.

---

### Task 4: Notifications — le tableau de bord en lecture

**Fichiers :**
- Create `src/features/joueurs/lib/catalogue.ts`, `lib/catalogue.test.ts`, `api/notifications.ts`, `hooks/useNotifications.ts`, `components/Notifications.tsx`, `components/Notifications.test.tsx`
- Modify `src/app/router.tsx`; peut-être `supabase/functions/send-push/categories.ts`, `payloads.ts` (R5)

**Interfaces :**
- `catalogue.ts` reprend l'ancien `apps/hub/src/lib/catalogueNotifications.ts` : `DESCRIPTIONS`, `sorteDe(type)`, `typesConnus(): string[]`, `typesQuiPartent(): string[]`, `catalogue(vues)` — copiés, nommage gardé, imports `../../../../../../supabase/functions/send-push/categories` et `…/payloads` (chemin relatif depuis `apps/hub-v2/src/features/joueurs/lib/`, à recompter).
- `lireNotificationsDuHub(): Promise<VueNotifications>` appelle `notifications_du_hub({ p_types: typesConnus(), p_fil: typesQuiPartent() })` ; `VueNotifications = { abonnes: number; cloche: string[]; sortes: { type; semaine; mois; derniere: string | null; cloche: boolean }[]; fil: { id; type; quand; lu: boolean; pour: string | null; qui: string | null; sur: string | null }[] }` (vérifier la forme exacte dans la définition de la mig 467).

- [ ] **Tests d'abord** : `catalogue.test.ts` — chaque type de `CATEGORY_BY_TYPE` a une description ; `typesQuiPartent()` n'a aucun type `silent` ; `mise_a_jour` part en `important`. `Notifications.test.tsx` — les trois chiffres (abonnés, « qui partent, ces 7 jours », « créées sans partir ») ; un type non silencieux sans ligne en 30 jours montre « Aucune en 30 jours : à vérifier. » ; une ligne du fil d'un compte effacé dit « compte effacé ».
- [ ] Lancer → échec attendu.
- [ ] Copier le catalogue ; lancer `pnpm tsc --noEmit` dans `apps/hub-v2`. **Si** `categories.ts`/`payloads.ts` lèvent des erreurs sous les options du Hub, les corriger dans `send-push` (typage seulement, aucun changement de comportement), puis vérifier `deno check supabase/functions/send-push/index.ts` si Deno est installé, sinon relire le diff à la main ; noter dans le commit que `send-push` n'est pas redéployée (code identique à l'exécution).
- [ ] Écrire l'api, le hook (clé `['hub-notifications']`), l'écran au modèle « tableau de bord » (Tuiles, trois Blocs « Partent en push », « Partent en push, en récapitulatif », « Ne partent pas », triés par `mois` décroissant, puis le fil).
- [ ] Tests verts ; lint ; build. Commit `feat(hub-v2): les notifications — ce qui part, ce qui dort, le fil`.

---

### Task 5: Réglages — texte de partage et image des pages SEO ; Explore lit le texte de partage

**Fichiers :**
- Create `apps/hub-v2/src/features/reglages/api/reglages.ts`, `hooks/useReglages.ts`, `components/Reglages.tsx`, `Reglages.module.css`, `Reglages.test.tsx`, `README.md`
- Create `apps/web-v2/src/features/lieu/api/phraseDePartage.ts` (+ test), `hooks/usePhraseDePartage.ts`
- Modify `apps/web-v2/src/features/lieu/components/FeuillePartager.tsx`, `apps/seo-pages/src/build.ts`, `apps/seo-pages/src/templates/photo.ts`, `apps/hub-v2/src/app/router.tsx`

**Interfaces :**
- Hub : `lireReglages(): Promise<{ partage: string; imageSeo: string }>` (lecture directe d'`app_settings`, clés `share_text_template`, `landing_image_desktop_url`, précédent `features/jeu/api/energie.ts`) ; `enregistrerPartage(texte: string)` et `enregistrerImageSeo(adresse: string)` en **upsert** `onConflict: 'key'` (l'ancien `update` ne faisait rien si la ligne manquait).
- Explore : `phraseDePartage(modele: string | null, nom: string): string` — fonction pure : modèle vide, nul ou sans `{name}` → `J’ai trouvé ${nom} sur Runes de Chêne EXPLORE - tu connais ?` ; sinon `modele.replaceAll('{name}', nom)`. `lireModeleDePartage(): Promise<string | null>` (clé `share_text_template`, `null` sur erreur) ; `usePhraseDePartage(nom)` (clé `['modele-de-partage']`, `staleTime` d'une heure).

- [ ] **Tests d'abord** : `phraseDePartage` — repli sur modèle `null`, `''`, `'   '`, sans `{name}` ; deux `{name}` remplacés (Review Focus 4). Hub `Reglages.test.tsx` — l'aperçu remplace `{name}` par « Abbaye de Fontenay » ; « Enregistrer » appelle l'upsert ; l'écran dit que l'image change « au prochain passage de la nuit » ; l'ancienne image passe à `retirerFichier('app-assets', …)` après l'enregistrement de la nouvelle ; sur une largeur de téléphone, les liens « Parler aux joueurs » sont en tête (R7).
- [ ] Lancer → échec.
- [ ] Écrire, d'après la maquette Réglages de la Task 1. Dans `FeuillePartager`, remplacer la constante `phrase` par `usePhraseDePartage(fiche.nom)` ; pendant le chargement, la phrase de repli (le bouton ne doit jamais attendre). Dans `apps/seo-pages`, `.replace('{name}', …)` → `.replaceAll('{name}', …)`.
- [ ] Tests verts dans les trois paquets ; `pnpm lint` et `pnpm build` dans `apps/hub-v2`, `apps/web-v2`, `apps/seo-pages`.
- [ ] Commit `feat(hub-v2): les réglages — texte de partage et image des pages SEO` puis `feat(web-v2): le partage d'un lieu lit le texte réglé dans le Hub`.
- [ ] **Déploiement d'Explore : pas dans cette tâche.** Il se fait à la Task 10, version montée (fonctionnalité → chiffre du milieu), après qu'Uriel a relu la phrase dans Réglages (R2).

---

### Task 6: Pages publiques — la zone, les routes avant la porte, les briques

**Fichiers :**
- Create `src/public/README.md`, `src/public/PagePublique.tsx` (+ `.module.css` : le cadre commun des trois pages, d'après la maquette), `src/public/briques/` (champs, case à cocher, bouton, message d'erreur — seulement ceux que la maquette montre ; README)
- Modify `src/app/router.tsx`, `src/app/router.test.tsx`; peut-être `packages/da/polices.ts` (poids manquant relevé à la Task 1)

**Interfaces :**
- Trois routes **sœurs** de `/`, déclarées avant elle : `{ path: 'soumettre-contenu', lazy: … }`, `{ path: 'flyer', … }`, `{ path: 'flyercadeau', … }`, chacune en `lazy` (le code admin ne se charge pas, Review Focus 2). React Router fait correspondre `/flyer/` à `flyer` : à vérifier par le test, ne rien ajouter si c'est le cas.
- Composants attendus par les tâches 7-9 : `PageFlyer`, `PageCadeau`, `PageSoumettre` (exports nommés, un dossier chacun sous `src/public/`). Pour cette tâche, chacun rend son seul titre.

- [ ] **Tests d'abord** (`router.test.tsx`) : `/flyer`, `/flyer/`, `/flyercadeau`, `/soumettre-contenu?quete=hoplite`, `/soumettre-contenu/` rendent la page publique **sans session** et **sans appel** à `hub_est_admin` ; avec une session admin, même résultat, sans la coquille (Review Focus 1 et 2) ; `/inconnue` mène toujours à `/`.
- [ ] Lancer → échec.
- [ ] Écrire la zone et les routes. Ajouter `README.md` de `src/public/` : « Pages vues par des joueurs depuis un QR ; aucune dépendance au Hub admin ; leurs adresses ne changent jamais (spec §3). »
- [ ] Tests verts ; lint ; build. Commit `feat(hub-v2): la zone des pages publiques, servies avant la porte de l'équipe`.

---

### Task 7: `/flyer` — les liens

**Fichiers :** Create `src/public/flyer/PageFlyer.tsx`, `PageFlyer.module.css`, `PageFlyer.test.tsx` ; `apps/hub-v2/public/` (images retenues par la maquette, reprises de `apps/hub/public/` si elles servent : `logo-slogan.webp`, `instagram.svg`, `fellowship-icon.png`…)

- [ ] **Test d'abord** : les cinq liens, dans l'ordre, avec leurs adresses exactes (`https://runesdechene.com`, `https://app.runesdechene.com`, `/flyercadeau`, `https://www.instagram.com/runesdechene`, `https://flw.sh/runesdechene`) ; les liens externes s'ouvrent dans le même onglet comme aujourd'hui (pas de `target` ajouté).
- [ ] Lancer → échec ; écrire d'après la maquette ; vert ; lint ; build.
- [ ] Commit `feat(hub-v2): /flyer au style V2`.

---

### Task 8: `/flyercadeau` et la fonction `flyer-create-account`

**Fichiers :**
- Create `src/public/cadeau/PageCadeau.tsx`, `.module.css`, `PageCadeau.test.tsx`, `src/public/cadeau/api.ts`
- Create `apps/hub-v2/netlify/functions/flyer-create-account.ts` (copie de `apps/hub/netlify/functions/flyer-create-account.ts`)
- Modify `apps/hub-v2/netlify/functions/README.md` (la fonction, ses variables : `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FLYER_PROMO_CODE`, `SHOPIFY_ACCESS_TOKEN`)

**Interfaces :** `demanderCadeau(email: string, newsletter: boolean): Promise<{ code: string }>` — `fetch('/.netlify/functions/flyer-create-account', { method: 'POST', body: JSON.stringify({ email, newsletter }) })`, réponse lue par `lireReponse` (`shared/lib/fonctions.ts` ; pas d'`appelerFonction`, qui joint un jeton de session qu'un visiteur n'a pas).

- [ ] Copier la fonction **à l'identique**, puis relire ses gardes comme au plan 4 (R2 du plan 4) : le frein par IP (15 par heure) reste ; la boutique est fixée à `runes-de-chene.myshopify.com` ; aucune valeur reçue n'est renvoyée telle quelle dans une erreur. Ajouter à `netlify/securite.test.ts` : un corps sans e-mail valide → 400 ; la 16ᵉ demande de la même IP dans l'heure → 429 (client Supabase simulé).
- [ ] **Tests d'abord** (`PageCadeau.test.tsx`) : e-mail invalide → le bouton reste inactif ; succès → le code et le lien `https://runesdechene.com/discount/<code>` ; 429 → « Trop d'essais depuis cet appareil, réessaie dans une heure. » ; fonction absente (HTML, 404) → message lisible, jamais « Unexpected token » ; la case newsletter est décochée au départ.
- [ ] Lancer → échec ; écrire d'après la maquette ; vert ; lint ; build.
- [ ] Commit `feat(hub-v2): /flyercadeau au style V2, la fonction du flyer déménage`.

---

### Task 9: `/soumettre-contenu` — les quatre étapes et l'envoi

**Fichiers :** Create `src/public/soumettre/PageSoumettre.tsx`, `Etape*.tsx` (une par étape), `Succes.tsx`, `.module.css`, `api.ts`, `lib/fichiers.ts` (+ test), `lib/compression.ts`, `useEnvoi.ts`, `PageSoumettre.test.tsx`

**Interfaces :**
- `lib/fichiers.ts` : `refusDuFichier(f: File): string | null` — image > 15 Mo, vidéo > 50 Mo, type hors jpg/jpeg/png/webp/heic/heif/mp4/mov/webm/m4v → la raison, en français, avec le nom du fichier ; `MAX_FICHIERS = 10`.
- `lib/compression.ts` : `versWebp(f: File): Promise<Blob>` (1920 px max, qualité 0,82 — reprise de l'ancien `StudioSubmit`) ; une vidéo passe telle quelle.
- `api.ts` : `lireMissions(): Promise<{ slug: string; title: string }[]>` (`missions`, `status = 'published'`, tri `starts_at` décroissant) ; `lireConfigStudio()` (seulement si la maquette garde les fonds, R8) ; `envoyerFichierPublic(f): Promise<string>` (bucket `community-photos`, chemin `submissions/<uuid>/<uuid>.<ext>`, `upsert: false`) ; `deposerContenu(…)` avec les douze paramètres de la mig 501, **noms exacts** relus dans `database.types.ts`.

- [ ] **Tests d'abord** :
  - `fichiers.test.ts` : 16 Mo d'image refusé, 49 Mo de vidéo accepté, 51 Mo refusé, `.gif` refusé, un 11ᵉ fichier refusé (Review Focus 3) ;
  - `PageSoumettre.test.tsx` : `?quete=hoplite` présélectionne la mission ; une quête inconnue ne présélectionne rien ; on n'avance pas sans fichier, sans taille pour chaque fichier, sans prénom ni e-mail, sans les deux accords ; l'envoi dit « fichier n sur N » ; un fichier en échec et deux réussis → `deposer_contenu` reçoit les deux chemins ; aucun fichier réussi → « Aucun fichier n'a pu partir… » et le formulaire reste rempli ; `nouveauCompte` → les couronnes de bienvenue au succès ; refus de la base (5 contributions par heure) → son message.
- [ ] Lancer → échec ; écrire d'après la maquette (une étape par écran, l'étape dans l'URL `?etape=2` — tout état navigable est une URL) ; vert ; lint ; build.
- [ ] Commit `feat(hub-v2): /soumettre-contenu au style V2`.

---

### Task 10: Blog de la boutique ; fin de « bientôt » ; préparation en ligne et parcours

**Fichiers :**
- Create `src/features/joueurs/api/blog.ts`, `hooks/useBlog.ts`, `components/Blog.tsx`, `TiroirArticle.tsx`, `Blog.test.tsx`, `lib/markdown.ts` (+ test)
- Modify `apps/hub-v2/netlify/functions/shopify-article.ts` (image retirée, R6), `package.json` (`marked`, `dompurify`)
- Delete `src/app/coquille/BientotIci.tsx`, `BientotIci.module.css` ; Modify `src/app/router.tsx` (plus d'`ECRANS_FAITS` ni d'`autres` : toutes les routes sont écrites), `src/app/README.md`, `coquille/README.md`

**Interfaces :**
- `lib/markdown.ts` : `versHtml(md: string, appel?: { url: string; libelle: string }): string` — `marked` puis `DOMPurify.sanitize` ; l'appel, s'il a une URL `http(s)`, ajoute un lien-bouton à la fin.
- `blog.ts` : `lireArticles()` (`list_announcements_admin()`), `creerArticle(type, titre)` (`create_announcement`), `enregistrerArticle(…)` (`update_announcement`, neuf paramètres, mig 254), `publierSurLaBoutique(article)` → `appelerFonction('shopify-article', { methode: 'POST', corps: { announcement: { title, body_html: versHtml(body, appel), cover_image, type }, shopify_article_id } })` puis `set_announcement_channel(id, 'blog', 'published', article_id)` — **son erreur est affichée** (l'ancien Hub l'ignorait).

- [ ] **Tests d'abord** : `markdown.test.ts` — un `<script>` dans le texte disparaît ; une liste et un gras sortent en HTML ; un appel `javascript:` est ignoré. `Blog.test.tsx` — la liste (titre, type, « Sur la boutique » ou « Brouillon ») ; le bouton dit « Publier sur la boutique » sans article Shopify, « Mettre à jour l'article » avec ; fonction en panne → son message ; l'ordre : la fonction d'abord, puis `set_announcement_channel`.
- [ ] Dans la copie de `shopify-article`, un `cover_image` vide → `image: null` envoyé au PUT ; test ajouté à `netlify/securite.test.ts` (ou un test voisin) sur le corps envoyé à Shopify.
- [ ] Lancer → échec ; écrire ; supprimer `BientotIci` ; vert ; lint ; build. Commits `feat(hub-v2): le blog de la boutique` et `refactor(hub-v2): tous les écrans sont là, plus de « bientôt »`.
- [ ] **Préparation en ligne** (contrôleur) : la 522 appliquée avec l'accord d'Uriel, types régénérés ; `FLYER_PROMO_CODE` copiée de l'ancien site sur `rdc-hub-v2` (noms comparés, valeurs jamais lues) ; `pnpm build` puis déploiement de `rdc-hub-v2` avec `--functions` (`.claude/rules/deploiement.md`).
- [ ] **Parcours dans le navigateur, à 1440 et 390 px**, comparé à chaque maquette : les quatre écrans, les trois pages publiques sur `rdc-hub-v2.netlify.app` (sans session : fenêtre privée), console lue. **Rien n'est écrit en prod sans Uriel** : pas de mise à jour publiée (elle envoie un push à tous), pas d'article, pas de contribution ni d'inscription flyer réelles — Uriel fait ces essais lui-même, avec une adresse à lui.
- [ ] Uriel relit le texte de partage dans Réglages ; puis Explore est déployé (version montée, `node scripts/sync-app-version.mjs`) et le partage d'un lieu vérifié sur le téléphone.

---

### Task 11: La bascule (contrôleur avec Uriel, étape par étape)

Chaque étape se vérifie avant la suivante. Lire `.claude/rules/deploiement.md` d'abord.

- [ ] **Avant** : la branche fusionnée dans `main` après l'essai connecté d'Uriel ; `rdc-hub-v2` porte toutes les variables de l'ancien site (noms comparés : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP`, `FLYER_PROMO_CODE`).
- [ ] **Shopify, lecture seule** : Uriel ouvre l'admin Shopify (Paramètres → Notifications → Webhooks, et l'appli de la boutique → adresse de retour OAuth) et lit les deux adresses. `hub.runesdechene.com/...` → rien à faire ; `hub-runesdechene.netlify.app/...` → à changer juste après le domaine.
- [ ] **Le domaine** : retirer `hub.runesdechene.com` du site `hub-runesdechene`, l'ajouter à `rdc-hub-v2` (Netlify, à la main ou `netlify api`), attendre le certificat. Vérifier : `curl -sI https://hub.runesdechene.com/` sert le build de `rdc-hub-v2` ; `/flyer`, `/flyercadeau`, `/soumettre-contenu?quete=hoplite` → 200 et la nouvelle page ; `/.netlify/functions/shopify-order-webhook` sans signature → 401 (la garde de la copie, preuve que c'est le nouveau site).
- [ ] **Le webhook en vrai** : attendre la prochaine commande payée (ou Uriel en passe une de test) ; la ligne apparaît dans `purchase_log` et le Fragment est débloqué. Jusque-là, l'ancien site reste en place (repli : remettre le domaine, une minute).
- [ ] **Le dépôt** :
  - `.github/workflows/cert-check.yml` : l'identifiant de `rdc-hub-v2` à la place de `d1cac03c-…` ;
  - `CLAUDE.md` racine (ligne du Back-office → `apps/hub-v2/`), `apps/hub-v2/CLAUDE.md`, `README.md`, `netlify.toml`, `netlify/functions/README.md` (plus de « préparation », plus de « pointe encore vers l'ancien site ») ; `shopify-callback` : le lien `/shopify/sync` → `/boutique/synchro` ;
  - `.claude/rules/deploiement.md` (tableau des sites, section « Le Hub », règle `--functions` : `apps/hub-v2`, identifiant de `rdc-hub-v2`) ; `.claude/rules/hub.md` réécrit (`paths: apps/hub-v2/**`, sans les références au code de l'ancien Hub ni à ses couleurs, le modèle de veille déplacé dans `produit.md` s'il y sert) ; `.claude/rules/v2.md` (la ligne sur `@types/react` 18) ;
  - `docs/db/gotchas.md:136` (`apps/web-v2`, `apps/hub-v2`), `docs/db/auth.md` (« Flow Hub » → `hub_est_admin`) ; `docs/tech-backlog.md` (lignes de l'ancien Hub et liste du plan 5 retirées, ce qui reste reporté) ;
  - **retirer `apps/hub/`**, puis `pnpm install` depuis le chemin à la bonne casse (le lockfile perd `apps/hub`), `pnpm build` des applis, tests verts ;
  - commit `chore(hub): la bascule — hub.runesdechene.com sert le Hub V2, l'ancien Hub retiré`, push.
- [ ] **Après une journée sans incident, avec l'accord d'Uriel** : rotation des clés (secret Shopify, `resend_api_key`, `email_trigger_secret`, `push_trigger_secret` ; pas VAPID — `docs/tech-backlog.md`), puis suppression du site Netlify `hub-runesdechene`. Décision écrite dans `_État.md`.

---

## Self-Review (fait à l'écriture)

1. **Couverture de la spec** : §3 adresses publiques → Tasks 6-9 ; `flyer-create-account` → Task 8 ; §5 menu « Parler aux joueurs » → Tasks 3, 4, 10 ; « Réglages » → Task 5 ; §11 tri (mises à jour, notifications, texte de partage, image SEO, blog seul) → Tasks 3, 4, 5, 10 ; §12.5 webhook → Task 11 ; §12.6 bascule, retrait, `hub.md` → Task 11 ; §13.3 (département caché) reste ouvert, hors de ce plan (aucun écran ne change à cause de lui).
2. **Espaces réservés** : aucun « à définir » ; les deux points qui dépendent d'une lecture (définition live de `flyer_signup_log`, forme exacte de `notifications_du_hub`) disent où lire.
3. **Noms** : `PageFlyer`, `PageCadeau`, `PageSoumettre` (Task 6 → 7, 8, 9) ; `phraseDePartage` (Task 5) ; `versHtml` (Task 10) ; clés de requête `['hub-mises-a-jour']`, `['hub-notifications']`, `['modele-de-partage']`.
4. **Review Focus** : chacune des cinq lignes a son test dans la tâche qui porte le code (6, 6, 9, 5, 3).
