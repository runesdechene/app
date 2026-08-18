---
updated: 2026-08-18T00:00:00Z
summary: "Accueil V2 revu : bloc « L'appel » ajouté, missions photo sauvées de l'oubli."
next_step: "Uriel maquette l'accueil sur Figma, puis on brainstorme la Carte."
---

<!-- Statut lu par XO sur la carte d'accueil. À tenir à jour à chaque session.
     Ce fichier ne porte que le DEV. Les arbitrages de contenu, de marque et de
     production vivent dans le xo-status de la Citadelle. -->

## Tâches

### 🟢 App V2 — refonte en fork parallèle (nouveau, 18/08)
- [x] Fondations tranchées : pas de compétition, visite en GPS, PWA, remplacera la V1
- [x] Squelette : barre d'onglets Accueil · Carte · Codex · Campement + avatar
- [x] Écran Compte client
- [x] Écran Accueil « Le Seuil » : 5 blocs, bandeau Saga, geste de salut en feuille de chêne
- [x] Accueil révisé (18/08) : bloc « L'appel », carrousel « Autour de toi » monté en haut
- [ ] Uriel maquette l'Accueil sur Figma pour fixer la direction artistique
- [ ] Brainstorm de la Carte, puis du Codex, puis du Campement
- [ ] Créer la nouvelle app (rien n'est codé — on est en conception)
- [ ] Au portage des appels : retirer `floor_glory`/`floor_crowns` et l'emoji par défaut

### 🟢 Fragments audio (en ligne depuis le 16/08) — écoute confirmée par Uriel le 18/08
- [x] Écouter un Fragment depuis une **fiche produit** : confirmer que la ligne porte le même identifiant que depuis la page motif — dernier maillon de la chaîne jamais vérifié
- [x] Comparer l'aspect du lecteur avant/après sur une page motif : les styles sont passés d'une portée limitée à la section à une portée globale, le rendu réel n'a pas été regardé
- [ ] Back-office connecté : liste joueurs, fiche joueur, tableau de bord, Fragments, Sync Shopify — lectures basculées sur la vue staff, non testables sans session admin

### Dette et améliorations connues
- [ ] Fenêtre de temps sur l'agrégat des écoutes — aujourd'hui il porte sur toute la durée de vie, pas de vue par drop
- [ ] Décider si l'identité de session doit survivre à la fermeture du navigateur — aujourd'hui un second onglet compte une seconde écoute
- [ ] **À trancher avec Uriel** : `Équipe/Mémoire/<agent>.démarrage.md` existe pour les 3 agents et ne contient que des consignes, pas de la mémoire. Généré au lancement ? Si oui, sa source pointe `_res/` qui n'existe plus. Non touché faute de savoir.

> Chantiers différés (CI, durcissement sécurité, échecs silencieux, dette) : `docs/tech-backlog.md`.
> Dette DB/SQL détaillée : `docs/db/tech-debt.md`.

## Mémoire

- **App V2 (18 août)** — conception en cours, **aucun code écrit**. Spec vivante :
  `docs/superpowers/specs/2026-08-18-app-v2-design.md` (fondations, squelette, Compte,
  Accueil ; restent Carte, Codex, Campement). Principe qui commande tout : *« la V2 n'enlève
  pas la progression, elle enlève la comparaison »* — moi contre moi-même, des pairs qui
  saluent au lieu de classer. Tombent donc : Coupe, La Cour/Couronnes, Compagnies, Gloire/XP,
  énigmes, Expéditions, Quêtes (~60-70 % du code V1). **La DA vient de la boutique, pas de
  l'app V1** : parchemin `#f4eee1`, titres `#403434`, accent **rouge sang `#833434`**, kaki
  `#46493c`, Bebas Neue + Cabin — le sépia doré `#C19A6B` de la V1 n'existe pas côté boutique.
  **Convention à tenir** : toute fonctionnalité V2 reliée au Hub reçoit une pastille
  « V2 compatible » dans l'interface du Hub.

- **« L'appel » — missions & rendez-vous (18 août, spec §6)** — les **missions photo
  existent déjà en production de bout en bout** (table `missions` + salon, écrans Hub de
  création et de modération, `MissionModal` côté app, `hub_photo_submissions.mission_id`
  avec `consent_brand_usage`, mur « Ils nous portent » sur la fiche produit). Elles
  n'étaient **écrites nulle part dans le spec V2** : candidates à mourir par oubli.
  Ne pas les confondre avec les « Quêtes du jour », qui tombent — l'erreur a déjà été faite.
  Missions et rendez-vous sont **deux types du même objet** ; delta pour ouvrir le physique :
  un champ `kind` + un lien vers un lieu. Un appel **rassemble, il ne classe pas** — jamais
  de gagnant. Contrainte posée pour le Campement : **la face publique d'un appel vit hors du
  portail**, sinon le nouveau venu qu'un rendez-vous fait marcher se cogne à une porte close.

- **Compteur d'écoutes des Fragments audio (16 août, migs 340-343)** — table `fragment_audio_plays` verrouillée : RLS forcée, zéro policy, privilèges révoqués à `anon` ET `authenticated`, tout passe par deux `SECURITY DEFINER`. `log_fragment_audio_play` (anon, écriture seule, ne lève jamais) et `get_fragment_audio_stats` (staff via `_is_staff()`, `EXECUTE` révoqué à `public` et `anon` — Postgres l'accorde à PUBLIC par défaut, piège déjà rencontré en mig 338). Une ligne par (session, illustration, surface, jour) ; `greatest()`/`OR` : les valeurs ne peuvent que monter. **Clé de comptage = `ill.system.handle` du métaobjet Illustration, JAMAIS le tag produit `fragment:*`** (migs 251-253 ont payé le prix des variations de casse). Le type de métaobjet est `illustrations` **au pluriel** — vérifié par sondage direct de l'API Admin, une constante au singulier aurait renvoyé une liste vide sans erreur. Portée `read_metaobjects` accordée le 16/08 ; `read_metaobject_definitions` ne l'est PAS et n'est pas nécessaire.
- **Ce que la mesure compte exactement** — le temps joué est accumulé par écarts entre positions successives, en rejetant tout écart supérieur à 1,5 s : c'est ce qui distingue une lecture d'un déplacement de la glissière. Seuil d'écoute : `min(10 s, 25 % de la durée)` de jeu **réel**. Complétion : 90 % du temps réellement joué. Sans ça le chiffre décisif se fabriquait en deux secondes — défaut trouvé en revue finale, pas avant. Si `system.handle` est vide, le lecteur fonctionne mais **la mesure se tait** : aucun repli, un repli aurait écrit des clés divergentes selon la surface.
- **Le Hub se conçoit** — `apps/hub` a un système de tokens dans `src/index.css` (parchemin `#f5edd8`, surface `#faf3e0`, brun `#3a2e1e`, rouge sang `#801c1c`, Cinzel pour les titres). Charger `frontend-design` avant tout nouvel écran ; un `<Composant>.css` à côté du `.tsx` est la convention. Deux défauts vus seulement en regardant le rendu réel : un compteur à 0 pendant le chargement se lit comme « tout est couvert », et une jauge en `<span>` sans `display:block` ne s'affiche pas du tout.
- **Fuite emails (6 août, mig 336)** : cause racine = `COALESCE(..., email_address)` comme dernier recours du nom public dans 6 fonctions live (`get_player_profile`, `get_leaderboard`, `get_faction_members`, `get_territory_votes`, `_create_place_internal`, `log_new_user_activity`). Remplacé par `user_public_name(id, display_name, first_name)` → `Explorateur XXXX` (4 hex du md5 de l'id) si pas de nom, et refuse toute valeur contenant `@`. 122 `activity_log` purgés. `anon` a perdu le SELECT table sur `users` (liste blanche : id, first_name, display_name, avatar_url, faction_id) — il pouvait aspirer les 4904 emails via `/rest/v1/users`.
- **Emails réservés au staff (6 août, migs 337-338)** : `users` est GRANTée colonne par colonne, sans `email_address` ni `password` ⇒ **toute nouvelle colonne de `users` doit être GRANTée explicitement**, et `select('*')` sur `users` est mort côté front. L'app s'identifie via `get_my_user_row()` (auth.uid puis email du JWT, SECURITY DEFINER) au lieu de `.eq('email_address', …)`. Le hub lit la vue `users_admin` (gardée par `_is_staff()` = admin|moderator) ; les écritures restent sur `users`. Aussi bouché : `purchase_log` (policy « service role » écrite sans `TO` ⇒ appliquée à anon, 504 lignes d'emails d'acheteurs publiques) et `hub_photo_submissions.submitter_email` (exposé par « approved is public »). Les policies modération lisaient `users` en direct → cassaient depuis la 336, passées par `_is_staff()`. Règles écrites dans `docs/db/gotchas.md` § Données personnelles.
- **Refonte écran d'intro borne (2 août)** : spec `apps/explore-web/docs/superpowers/specs/2026-08-02-demo-intro-refonte-wording-design.md`. Composants : `DemoKioskShell` (contenu) + `DemoLiveProof` (bandeau preuve vivante, lecture seule, rend `null` si le réseau du stand lâche). CSS mort `.demo-mantra-*` supprimé. **Retour arrière** : tag `demo-intro-v1` (commit 0744d50c) ou rollback Netlify en un clic.
- **Démo borne (1 juil.)** : site Netlify `runesdechene-demo` (id 01d23d77-db08-4ecd-a0b6-f2b76035deb6), domaine `demo.runesdechene.com`, CNAME `demo` → `runesdechene-demo.netlify.app`. Build **sur Netlify** (base `apps/explore-web`, `pnpm build`, Node 22), branche `demo-borne`, auto-deploy à chaque push dessus. 6 vars d'env dont `VITE_DEMO_MODE=true` et `VITE_DEMO_PASSWORD=borne`. Base = LIVE prod, zéro écriture via proxy client.
- **Compte démo** : `demo@runesdechene.com` / mot de passe **`borne`** (reset admin le 1 juil.). Auto-login via `useDemoBootstrap`.
- **Fix build Netlify** : pnpm 10 bloque le post-install esbuild → `onlyBuiltDependencies:[esbuild]` + `packageManager: pnpm@10.5.2` dans le package.json racine (commit c9d744d).
- **Ménage XO (18 août)** : le hook `SessionStart` qui forçait la lecture de `~/citadelle/CLAUDE.md` est supprimé (chemin mort — le fichier est dans `_ContexteIA/`), et `~/.claude/CLAUDE.md` global est retiré (sauvegarde `~/.claude/CLAUDE.md.removed-2026-08-18`) : il imposait à tous les projets la règle de push du 6 avril, que `docs/xo-discipline.md` §E4 a explicitement abandonnée le 5 mai. Chaque repo porte ses consignes ; `~/citadelle/` a reçu un `CLAUDE.md` racine relais, il n'en avait pas.
