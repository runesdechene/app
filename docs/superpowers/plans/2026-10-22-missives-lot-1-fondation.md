# Missives — lot 1 (fondation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uriel écrit une Missive dans le Hub, directement dans le modèle, et l'envoie (ou la programme) par Resend aux personnes qui ont accepté les nouvelles.

**Architecture:** Les modèles d'e-mail sont des composants React Email dans un paquet du dépôt (`packages/missives`), utilisés à la fois par l'écran « Écrire » du Hub (affichage éditable) et par une fonction Netlify qui rend et envoie. `pg_cron` réveille cette fonction toutes les 5 minutes par `net.http_post`, comme `trigger_email_on_notification` (mig 175). L'accord marketing vit sur `users` et se synchronise avec Shopify (dernière action gagne).

**Tech Stack:** React 19, TypeScript strict, Vite, Vitest, `@react-email/components` et `@react-email/render`, Resend (API REST, envoi groupé), Supabase (Postgres, RLS, `pg_cron`, `pg_net`), fonctions Netlify (Node 22).

**Spec:** `docs/superpowers/specs/2026-10-22-mailing-parcours-client-design.md` (maquettes Figma App v2, page « Hub Emails » : Missive `748:2521`, Fragment `743:2464`, Carnet de route `745:2464`, Écrire `753:2529`, Choix ouvert `756:2592`, Listes `713:2091`).

## Global Constraints

- pnpm uniquement ; `pnpm dlx supabase` pour la base. TS strict : ni `any`, ni `@ts-ignore`, ni `as unknown as`. Conventional Commits, commit à chaque tâche verte.
- Migrations : numéro suivant `538`, en tête `-- WHY:` et `-- SCHEMA CHECKED (date, live)`, schéma vérifié sur la base live avant d'écrire (`information_schema`), appliquées par `pnpm dlx supabase db push --linked`, puis `pnpm --filter hub-v2 gen:types`.
- Polices des e-mails : Bebas Neue (grands titres), Alegreya (texte), Cabin Condensed (rubriques). **Aucune italique.** Pas d'encart arrondi, pas de bouton-pilule : appels en liens soulignés ou en grandes lettres soulignées.
- Trois couleurs par envoi : `fond`, `titres`, `rupture`. Texte et rubriques déduits. Palette de la marque : fond `#3f3024`, titres `#c49a5a`, rupture `#a94842`. Refus d'envoyer sous le contraste WCAG AA (4,5:1 pour le texte courant).
- Expéditeur : `Uriel · Runes de Chêne <uriel@missives.runesdechene.com>` ; réponses vers la même adresse.
- Un envoi manuel ne part qu'à `users.accord_nouvelles = true` et `supprime_le IS NULL`. Chaque e-mail porte `List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- Écrans du Hub : briques `shared/ui` (`Bouton`, `Bloc`, `EnTeteDePage`…), DA `packages/da`, comparés à la maquette à 1440 et 390 px. Charger `frontend-design` avant d'écrire un écran.
- Fonctions Netlify : secrets en variables d'environnement, jamais d'e-mail ni de texte d'erreur distant renvoyé au client ; garde-fous testés dans `apps/hub-v2/netlify/securite.test.ts`. Déploiement manuel (`.claude/rules/deploiement.md`).

## Review Focus

1. **Un destinataire sans prénom** : « Salut , » ne doit jamais partir. Le prénom manquant devient « Explorateur ». → test dans la tâche 3.
2. **Le réveil qui passe deux fois** (cron qui chevauche, relance après erreur) : personne ne reçoit deux fois la même Missive. → test dans la tâche 4.
3. **Un compte supprimé ou désabonné entre la programmation et l'envoi** : il ne reçoit rien. La liste se résout au moment de l'envoi, pas de la programmation. → test dans la tâche 4.
4. **Une réponse partielle de Resend** (un lot à moitié refusé) : chaque refus est noté `echec` avec sa raison, les autres sont `envoye`, rien n'est retenté en double. → test dans la tâche 4.
5. **Un texte très long** (titre de 90 caractères, nouvelle de 2 000 caractères) : le modèle reste lisible, rien ne déborde du 600 px. → test dans la tâche 3, vérifié à l'œil à la tâche 11.

---

### Task 1: La base — accord, ambassadeurs, missives et envois

**Files:**
- Create: `supabase/migrations/539_missives_fondation.sql`
- Modify: `apps/hub-v2/src/shared/supabase/database.types.ts` (régénéré)

**Interfaces:**
- Produces :
  - `users.accord_nouvelles boolean NOT NULL DEFAULT false`, `users.accord_nouvelles_le timestamptz`, `users.accord_nouvelles_porte text` (`'stand' | 'flyer' | 'site' | 'appli' | 'shopify' | 'hub' | 'desabonnement' | 'rebond'`).
  - `ambassadeurs (user_id uuid PK → users, role text CHECK in ('ambassadeur','egerie'), ajoute_le timestamptz DEFAULT now())`.
  - `missives (id bigint identity PK, modele text CHECK in ('missive','fragment','carnet'), couleurs jsonb NOT NULL, contenu jsonb NOT NULL, objet text NOT NULL, apercu text, liste text CHECK in ('tous','prospects','porteurs','meilleurs','ambassadeurs'), statut text CHECK in ('brouillon','programmee','en_cours','envoyee') DEFAULT 'brouillon', programmee_le timestamptz, envoyee_le timestamptz, cree_le timestamptz DEFAULT now())`.
  - `missive_envois (missive_id bigint → missives, user_id uuid → users, statut text CHECK in ('a_envoyer','envoye','echec','rebond','plainte') DEFAULT 'a_envoyer', resend_id text, erreur text, envoye_le timestamptz, ouvert_le timestamptz, clique_le timestamptz, PRIMARY KEY (missive_id, user_id))`.
  - RLS activée, lecture et écriture réservées à `hub_est_admin()`. Le service role écrit tout.
  - `hub_listes() RETURNS jsonb` : `[{cle, personnes, avec_accord}]` pour les cinq listes. Prospects = aucune ligne `user_fragments` ; Porteurs ≥ 1 ; Meilleurs ≥ 5 ; Ambassadeurs = table `ambassadeurs`.
  - `missives_destinataires(p_missive bigint) RETURNS TABLE (user_id uuid, email text, prenom text)` : liste de la Missive, avec `accord_nouvelles` et `supprime_le IS NULL`, sans les lignes déjà dans `missive_envois`. `SECURITY DEFINER`, exécutable par `service_role` seul.

- [ ] **Step 1: Vérifier le schéma live** : `users` (colonnes ci-dessus absentes), `user_fragments(user_id, fragment_id)`, `hub_est_admin()` existe. Noter le résultat dans l'en-tête `SCHEMA CHECKED`.
- [ ] **Step 2: Écrire la migration** (tables, colonnes, RLS, les deux fonctions, `REVOKE` d'`anon`).
- [ ] **Step 3: Appliquer** : `pnpm dlx supabase db push --linked` → sortie sans erreur.
- [ ] **Step 4: Vérifier en prod** avec le service role :
  `select hub_listes();` (cinq clés, nombres plausibles) et `select count(*) from missives_destinataires(0);` → 0 sans erreur ; un appel `hub_listes` avec la clé `anon` → refusé.
- [ ] **Step 5: Régénérer les types** : `pnpm --filter hub-v2 gen:types`, `pnpm --filter hub-v2 typecheck` → OK.
- [ ] **Step 6: Commit** `feat(db): missives, envois et accord aux nouvelles`

### Task 2: L'accord arrive par toutes les portes

**Files:**
- Modify: `apps/hub-v2/netlify/functions/stand-create-account.ts`, `apps/hub-v2/netlify/functions/flyer-create-account.ts`, `apps/hub-v2/netlify/functions/shopify-sync.ts`
- Create: `apps/hub-v2/netlify/functions/shopify-client-webhook.ts`, `apps/hub-v2/netlify/functions/lib/accord.ts`
- Create: `supabase/migrations/540_accord_depuis_l_appli.sql` (RPC `donner_accord_nouvelles(p_accord boolean)`, porte `'appli'`, `auth.uid()` seul)
- Modify: `apps/web-v2/src/features/onboarding/components/Charte.tsx` (case « Recevoir les nouvelles de Runes de Chêne », non cochée par défaut) et `Onboarding.test.tsx`
- Test: `apps/hub-v2/netlify/securite.test.ts`, `apps/hub-v2/netlify/accord.test.ts`

**Interfaces:**
- Consumes : colonnes `accord_nouvelles*` (tâche 1).
- Produces : `appliquerAccord(actuel: {accord: boolean, le: string | null}, recu: {accord: boolean, le: string, porte: Porte}): {accord, le, porte} | null` dans `lib/accord.ts` (fonction pure : `null` si `recu.le` est plus ancien que `actuel.le`, la dernière action gagne).

- [ ] **Step 1: Test de `appliquerAccord`** : un accord plus récent l'emporte ; un plus ancien renvoie `null` ; un désabonnement récent l'emporte sur un vieil abonnement Shopify.
- [ ] **Step 2: Le voir échouer**, puis **écrire `appliquerAccord`**, **le voir passer** : `pnpm --filter hub-v2 test accord`.
- [ ] **Step 3: Tests de garde du webhook client** dans `securite.test.ts` : sans signature HMAC → 401 ; signature fausse → 401 ; `customers/create` valide avec `email_marketing_consent.state = 'subscribed'` → la fiche reçoit `accord_nouvelles = true`, porte `'site'`.
- [ ] **Step 4: Écrire `shopify-client-webhook`** (sujets `customers/create` et `customers/update`, même vérification HMAC que `shopify-order-webhook`, crée la fiche si l'e-mail est inconnu avec `account_source = 'shopify'`).
- [ ] **Step 5: Portes existantes** : stand et flyer écrivent l'accord (portes `'stand'`, `'flyer'`) quand la case est cochée ; `shopify-sync` demande `email_marketing_consent` et passe par `appliquerAccord` (porte `'shopify'`). Les nouvelles inscriptions par ces portes datent l'accord du moment présent.
- [ ] **Step 6: L'appli** : migration 540, case à la Charte, test du composant (la case non cochée n'appelle pas la RPC).
- [ ] **Step 7: Tests verts** : `pnpm --filter hub-v2 test` et `pnpm --filter web-v2 test`.
- [ ] **Step 8: Commit** `feat(missives): l'accord aux nouvelles arrive par toutes les portes`

À faire par Uriel après déploiement : déclarer dans Shopify le webhook `customers/create` et `customers/update` vers `https://hub.runesdechene.com/.netlify/functions/shopify-client-webhook`.

### Task 3: Les modèles en React Email

**Files:**
- Create: `packages/missives/package.json` (`@runes/missives`), `packages/missives/src/couleurs.ts`, `packages/missives/src/types.ts`, `packages/missives/src/briques/*.tsx` (EnTete, Lettrine, Rupture, Signature, Pied), `packages/missives/src/modeles/Missive.tsx`, `Fragment.tsx`, `Carnet.tsx`, `packages/missives/src/rendre.ts`
- Test: `packages/missives/src/couleurs.test.ts`, `packages/missives/src/rendre.test.ts`

**Interfaces:**
- Produces :
  - `type Couleurs = { fond: string; titres: string; rupture: string }` ; `const PALETTE_MARQUE: Couleurs` ; `PALETTES: Record<'marque'|'hiver'|'printemps'|'ete'|'automne', Couleurs>` (valeurs des maquettes : hiver `#1f2328 / #d6bd8c / #2e4a3b`).
  - `deduireCouleurs(c: Couleurs): Couleurs & { texte: string; rubriques: string }` (crème `#f5ead6` sur fond sombre, encre `#3f3024` sur fond clair ; rubriques = `titres` éclaircies de 25 %).
  - `contrasteSuffisant(c: Couleurs): boolean` (WCAG AA 4,5:1 entre `texte` et `fond`, et entre `texte` et `rupture`).
  - `type ContenuMissive` (titre, photo {url, legende, inclinaison}, ouverture, corps, nouvelles: {titre, texte, lien}[] (1 à 5), rupture {titre, texte, appel, lien, photo?}) ; `ContenuFragment` ; `ContenuCarnet` — un champ par zone des maquettes.
  - `type Modele = 'missive' | 'fragment' | 'carnet'`.
  - `rendre(modele: Modele, contenu, couleurs: Couleurs, destinataire: { prenom: string | null; lienDesabonnement: string }): Promise<{ html: string; texte: string }>`.
  - Chaque modèle exporte aussi son composant React avec la prop `edition?: { onChange(zone: string, valeur: unknown): void }`, utilisée par le Hub (tâche 8).

- [ ] **Step 1: Tests de `couleurs.ts`** : la palette de la marque passe `contrasteSuffisant` ; `{fond:'#f5ead6', titres:'#f0e0c0', rupture:'#f5ead6'}` échoue ; `deduireCouleurs` donne un texte crème sur `#3f3024` et encre sur `#f5ead6`.
- [ ] **Step 2: Les voir échouer, écrire `couleurs.ts`, les voir passer** : `pnpm --filter @runes/missives test`.
- [ ] **Step 3: Tests de `rendre`** : le HTML contient l'objet du titre, « Salut Kelpie » pour `prenom: 'Kelpie'` et « Salut Explorateur » pour `prenom: null` ; il contient le lien de désabonnement ; il ne contient ni `font-style:italic` ni `<em>` ; un titre de 90 caractères et une nouvelle de 2 000 caractères ne posent aucune largeur au-delà de 600 px (`max-width:600px` sur le conteneur, aucune largeur fixe supérieure).
- [ ] **Step 4: Écrire les briques et les trois modèles** au plus près des maquettes (polices par `<Font>` de React Email avec repli `Georgia` pour Alegreya et `Arial Narrow, Arial` pour Bebas ; photo penchée = image déjà inclinée, tâche 8).
- [ ] **Step 5: Tests verts**, puis **prévisualiser** les trois modèles avec `email dev` de React Email et comparer à la maquette.
- [ ] **Step 6: Commit** `feat(missives): les modèles Missive, Fragment et Carnet de route`

### Task 4: La fonction qui envoie

**Files:**
- Create: `apps/hub-v2/netlify/functions/missives-envoyer.ts`, `apps/hub-v2/netlify/functions/lib/resend.ts`, `apps/hub-v2/netlify/functions/lib/jeton.ts`
- Create: `supabase/migrations/541_missives_reveil.sql` (`cron.schedule('missives_envoi', '*/5 * * * *', …)` → `net.http_post` vers `app_settings.missives_envoi_url` avec l'en-tête `X-Missives-Secret` = `app_settings.missives_secret`)
- Test: `apps/hub-v2/netlify/missives-envoyer.test.ts`

**Interfaces:**
- Consumes : `missives_destinataires` (tâche 1), `rendre` (tâche 3).
- Produces :
  - `signer(userId: string): string` et `verifier(jeton: string): string | null` dans `lib/jeton.ts` (HMAC-SHA256 avec `MISSIVES_SECRET`, encodage base64url, jeton = `userId.signature`).
  - `envoyerParLots(messages: MessageResend[], cle: string): Promise<{ id?: string; erreur?: string }[]>` dans `lib/resend.ts` (lots de 100, `POST https://api.resend.com/emails/batch`).
  - La fonction : `POST` avec `X-Missives-Secret` ; prend les missives `programmee` dont `programmee_le <= now()` ; passe la missive `en_cours` par un `UPDATE … WHERE statut = 'programmee' RETURNING` (un seul réveil la prend) ; insère les `missive_envois` en `a_envoyer` ; rend chaque e-mail ; envoie ; note `envoye` ou `echec` ; passe la missive `envoyee`.

- [ ] **Step 1: Tests** (fetch simulé) : sans en-tête ou en-tête faux → 401 ; deux réveils simultanés sur la même missive → un seul envoi par personne ; un destinataire désabonné après la programmation n'est pas appelé ; un lot dont Resend refuse 2 messages sur 5 → 3 `envoye`, 2 `echec` avec leur raison ; chaque message porte `List-Unsubscribe` (lien `/desabonnement?j=` signé et `mailto:`) et `List-Unsubscribe-Post`.
- [ ] **Step 2: Les voir échouer**, **écrire la fonction et ses deux aides**, **les voir passer** : `pnpm --filter hub-v2 test missives-envoyer`.
- [ ] **Step 3: Migration 541**, appliquée ; `select * from cron.job where jobname = 'missives_envoi';` → une ligne.
- [ ] **Step 4: Commit** `feat(missives): l'envoi programmé par Resend`

### Task 5: Désabonnement et suivi des envois

**Files:**
- Create: `apps/hub-v2/netlify/functions/missives-desabonnement.ts`, `apps/hub-v2/netlify/functions/resend-webhook.ts`
- Create: `apps/hub-v2/src/public/desabonnement/PageDesabonnement.tsx` (+ route publique `desabonnement` dans `src/app/router.tsx`, à côté de `flyer`) et son test
- Test: `apps/hub-v2/netlify/missives-desabonnement.test.ts`, `apps/hub-v2/netlify/resend-webhook.test.ts`

**Interfaces:**
- Consumes : `verifier` (tâche 4), `appliquerAccord` (tâche 2).
- Produces : `POST /.netlify/functions/missives-desabonnement` (corps `{ j }` ou `List-Unsubscribe=One-Click` avec `?j=`) → `accord_nouvelles = false`, porte `'desabonnement'`, et accord Shopify passé à `unsubscribed` ; `POST /.netlify/functions/resend-webhook` (signature Svix vérifiée avec `RESEND_WEBHOOK_SECRET`) → `missive_envois` : `email.opened` → `ouvert_le`, `email.clicked` → `clique_le`, `email.bounced` → `rebond` + accord `false` porte `'rebond'`, `email.complained` → `plainte` + accord `false`.

- [ ] **Step 1: Tests** : jeton faux → 400 sans rien écrire ; jeton bon → accord `false` et appel Shopify ; second désabonnement → 200 sans erreur ; webhook sans signature → 401 ; `email.bounced` signé → statut `rebond` et accord retiré.
- [ ] **Step 2: Échec, code, succès** : `pnpm --filter hub-v2 test desabonnement resend-webhook`.
- [ ] **Step 3: La page publique** au design de `/flyercadeau` (briques `Public/*`) : « Tu ne recevras plus nos Missives. » et un lien « Je me suis trompé » qui renvoie vers le formulaire de réabonnement du site. Test : la page appelle la fonction avec le jeton de l'URL.
- [ ] **Step 4: Commit** `feat(missives): désabonnement en un clic et suivi Resend`

### Task 6: La brique Choix

**Files:**
- Create: `apps/hub-v2/src/shared/ui/Choix.tsx`, `apps/hub-v2/src/shared/ui/Choix.module.css`
- Modify: `apps/hub-v2/src/shared/ui/README.md`, `apps/hub-v2/src/shared/ui/briques2.test.tsx`

**Interfaces:**
- Produces : `Choix<T extends string>(props: { valeur: T; options: { valeur: T; libelle: string; groupe: string; detail?: string; vignette?: ReactNode }[]; onChange(v: T): void; recherche?: boolean; libelleAccessible: string })`. Fermé : vignette, libellé, détail, flèche. Ouvert : recherche, groupes, l'option choisie cochée. Clavier : flèches, Entrée, Échap ; `role="listbox"`, `aria-expanded`.

- [ ] **Step 1: Tests** : l'ouverture montre les groupes ; taper « carn » ne garde que « Carnet de route » ; Entrée choisit et referme ; Échap referme sans changer.
- [ ] **Step 2: Échec, brique, succès.** Comparer à la maquette `756:2592`.
- [ ] **Step 3: Commit** `feat(hub): la brique Choix`

### Task 7: Le groupe Missives et l'écran Listes

**Files:**
- Create: `apps/hub-v2/src/features/missives/` (`README.md`, `api/listes.ts`, `hooks/useListes.ts`, `components/Listes.tsx`, `components/Listes.test.tsx`, `components/Missives.module.css`)
- Modify: `apps/hub-v2/src/app/router.tsx` (routes `missives/ecrire`, `missives/envois`, `missives/listes`), le menu du Hub (groupe « Missives » entre « Fragments et boutique » et « Parler aux joueurs »)
- Create: `supabase/migrations/542_ambassadeurs_hub.sql` (`hub_ambassadeur(p_user uuid, p_role text)` et `hub_retirer_ambassadeur(p_user uuid)`, admin)

**Interfaces:**
- Consumes : `hub_listes` (tâche 1).
- Produces : `lireListes(): Promise<{ cle: Liste; personnes: number; avecAccord: number }[]>` ; `type Liste = 'tous' | 'prospects' | 'porteurs' | 'meilleurs' | 'ambassadeurs'`.

- [ ] **Step 1: Test de l'écran** : cinq lignes avec leurs nombres ; ajouter un ambassadeur par la recherche appelle `hub_ambassadeur` ; « Retirer » appelle `hub_retirer_ambassadeur`.
- [ ] **Step 2: Échec, écran (maquette `713:2091`), succès.** Migration 542 appliquée, types régénérés.
- [ ] **Step 3: Commit** `feat(missives): le groupe Missives et l'écran Listes`

### Task 8: Écrire dans le modèle

**Files:**
- Create: `apps/hub-v2/src/features/missives/lib/brouillon.ts` (+ test), `api/missives.ts`, `hooks/useMissive.ts`, `lib/pencher.ts` (+ test), `components/Ecrire.tsx`, `components/Reglages.tsx`, `components/Ecrire.test.tsx`
- Create: `supabase/migrations/543_missives_hub.sql` (bucket de stockage `missives` en lecture publique, écriture admin ; `hub_enregistrer_missive(p jsonb) RETURNS bigint`, `hub_programmer_missive(p_id bigint, p_quand timestamptz)`)
- Create: `apps/hub-v2/netlify/functions/missives-essai.ts` (garde admin comme `stand-create-account` ; rend la missive avec `rendre` et l'envoie tout de suite à l'adresse de l'admin connecté, objet préfixé « [Essai] ») et son test dans `securite.test.ts` (joueur → 403)
- Modify: `apps/hub-v2/package.json` (dépendance `@runes/missives: workspace:*`)

**Interfaces:**
- Consumes : composants de modèle et `rendre` (tâche 3), `Choix` (tâche 6), `Liste` (tâche 7), `contrasteSuffisant` (tâche 3).
- Produces :
  - `brouillonVide(modele: Modele): Brouillon` ; `changerZone(b: Brouillon, zone: string, valeur: unknown): Brouillon` ; `ajouterNouvelle`, `deplacerNouvelle(b, de: number, vers: number)`, `supprimerNouvelle(b, i)` — fonctions pures.
  - `pencher(fichier: File, degres: number): Promise<Blob>` (canvas : l'image pivote et se recadre, JPEG 0,85, 1 200 px de large au plus) ; la photo envoyée est déjà inclinée.

- [ ] **Step 1: Tests de `brouillon.ts`** : `brouillonVide('missive')` a trois nouvelles vides ; une sixième nouvelle est refusée ; `deplacerNouvelle(b, 2, 0)` met la troisième en tête ; changer de modèle garde l'objet et les couleurs.
- [ ] **Step 2: Test de `pencher`** : une image 1600×900 penchée de 2,5° sort en 1 200 px de large.
- [ ] **Step 3: Échec, code, succès.**
- [ ] **Step 4: Test de l'écran** : choisir « Fragment » dans `Choix` affiche le modèle Fragment ; taper dans le titre met à jour le brouillon ; une palette remplit les trois couleurs ; des couleurs illisibles désactivent « Programmer » et affichent « Le texte deviendrait difficile à lire. » ; « M'envoyer un essai » appelle `missives-essai` par `appelerFonction` ; « Programmer pour N personnes » montre le nombre `avecAccord` de la liste choisie.
- [ ] **Step 5: Échec, écran (maquette `753:2529` : réglages à gauche, e-mail à 600 px au centre, zones en pointillés au survol), succès.** Migration 543 appliquée, types régénérés.
- [ ] **Step 6: Commit** `feat(missives): écrire dans le modèle`

### Task 9: L'écran Envois

**Files:**
- Create: `apps/hub-v2/src/features/missives/components/Envois.tsx` (+ test), `api/envois.ts`
- Create: `supabase/migrations/544_missives_envois_hub.sql` (`hub_envois() RETURNS jsonb` : par missive, objet, liste, date, envoyés, échecs, ouverts, clics)

**Interfaces:**
- Produces : `lireEnvois(): Promise<{ id: number; objet: string; liste: Liste; statut: string; date: string | null; envoyes: number; echecs: number; ouverts: number; clics: number }[]>`.

- [ ] **Step 1: Test** : une ligne par missive ; une missive programmée s'affiche « Programmée pour le 7 décembre, 18 h » ; un brouillon s'ouvre dans « Écrire ».
- [ ] **Step 2: Échec, écran au style de « Comptes », succès.**
- [ ] **Step 3: Commit** `feat(missives): l'écran Envois`

### Task 10: Mise en route (Uriel et moi)

- [ ] **Step 1 (Uriel)** : créer le domaine `missives.runesdechene.com` dans Resend (compte pro), puis copier ses enregistrements (SPF, DKIM, MX de retour, DMARC) dans la zone DNS chez o2switch. Je prépare la liste exacte des enregistrements ; Uriel les saisit et entre lui-même la clé d'API.
- [ ] **Step 2 (Uriel)** : variables Netlify du site `rdc-hub-v2` : `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MISSIVES_SECRET` ; webhook Resend vers `https://hub.runesdechene.com/.netlify/functions/resend-webhook` ; webhook client Shopify (tâche 2).
- [ ] **Step 3 (moi)** : `app_settings` `missives_envoi_url` et `missives_secret` ; vérifier le domaine « Verified » dans Resend.
- [ ] **Step 4** : `pnpm --filter hub-v2 build` puis déploiement manuel du Hub (`.claude/rules/deploiement.md`).

### Task 11: L'essai réel

- [ ] **Step 1** : Uriel écrit une Missive d'essai dans le Hub, palette Hiver, et se l'envoie en essai.
- [ ] **Step 2** : la lire dans Gmail (web et téléphone), Outlook, Apple Mail ; comparer à la maquette `748:2521` ; vérifier qu'aucune italique n'apparaît, que les liens marchent, que le désabonnement en un clic désabonne vraiment (fiche dans le Hub, client Shopify).
- [ ] **Step 3** : trancher le point ouvert de la spec : grands titres en image ou police de repli.
- [ ] **Step 4** : première Missive programmée vers « Tout le monde » (les contacts existants : la Missive écrite à la main de la spec).
- [ ] **Step 5** : `_État.md` du vault à jour ; push.
