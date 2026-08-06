---
updated: 2026-08-06T12:30:00Z
summary: "Fuite d'emails corrigée en prod (migration 336). Les comptes qui n'allaient pas au bout de l'inscription voyaient leur adresse email servir de pseudo public : 444 comptes sur 4904 étaient concernés, plus 122 lignes du fil d'activité. Un seul helper décide désormais du nom public et ne peut plus retomber sur un email ; les anciennes lignes sont purgées. Au passage, la clé publique du site ne permet plus d'aspirer le fichier d'adresses. Il reste un trou : n'importe quel compte connecté peut encore lire les emails de tous les autres — ça demande une retouche de l'app, pas seulement de la base."
next_step: "Décider si on ferme tout de suite le dernier trou (lecture des emails par un compte connecté) : ça demande une nouvelle route serveur pour l'identification au démarrage et un déploiement de l'app. Sinon, reprendre la borne démo : voir l'écran d'intro sur la vraie borne et préciser ce qu'affichera le scan du Fragment."
---

<!-- Statut lu par XO sur la carte d'accueil. À tenir à jour à chaque session. -->

## Tâches

- [ ] Fermer le dernier trou emails : un compte connecté peut encore lire l'adresse de tous les autres (route serveur d'identification + retrait de l'accès direct + déploiement app)
- [ ] Voir l'écran d'intro refondu sur la vraie borne (lisibilité à 2 m, bandeau preuve vivante)
- [ ] Définir ce qu'affichera le scan du Fragment (RA ?) → ajuster le teaser de l'encart stand
- [ ] Release v1 refonte-identité : écran révélation « ta Maison devient ta classe » + QCM « Quel explorateur es-tu ? » (branche v1-refonte-identite)
- [ ] Release coordonnée v1 : db push migs 271-274 + netlify deploy app prod

## Mémoire

- **Fuite emails (6 août, mig 336)** : cause racine = `COALESCE(..., email_address)` comme dernier recours du nom public dans 6 fonctions live (`get_player_profile`, `get_leaderboard`, `get_faction_members`, `get_territory_votes`, `_create_place_internal`, `log_new_user_activity`). Remplacé par `user_public_name(id, display_name, first_name)` → `Explorateur XXXX` (4 hex du md5 de l'id) si pas de nom, et refuse toute valeur contenant `@`. 122 `activity_log` purgés. `anon` a perdu le SELECT table sur `users` (liste blanche : id, first_name, display_name, avatar_url, faction_id) — il pouvait aspirer les 4904 emails via `/rest/v1/users`. **Non couvert** : `authenticated` garde le SELECT complet, car `usePlayer.ts` identifie le joueur via `.eq('email_address', user.email)` (héritage de la migration d'ID Firebase→Supabase). Fermer ça = RPC `get_my_user_row()` SECURITY DEFINER (auth.uid() puis auth.email()) + REVOKE + déploiement app.
- **Refonte écran d'intro borne (2 août)** : spec `apps/explore-web/docs/superpowers/specs/2026-08-02-demo-intro-refonte-wording-design.md`. Problème traité : le passant du stand ne faisait pas le lien entre « Portez l'Histoire » et une app mobile, et la communauté n'était nulle part. Composants : `DemoKioskShell` (contenu) + nouveau `DemoLiveProof` (bandeau preuve vivante, lecture seule, rend `null` si le réseau du stand lâche). CSS mort `.demo-mantra-*` supprimé. **Retour arrière** : tag `demo-intro-v1` (commit 0744d50c) ou rollback Netlify en un clic.
- **Démo borne (fait le 1 juil.)** : site Netlify `runesdechene-demo` (id 01d23d77-db08-4ecd-a0b6-f2b76035deb6), domaine `demo.runesdechene.com`, CNAME `demo` → `runesdechene-demo.netlify.app`. Build **sur Netlify** (base `apps/explore-web`, `pnpm build`, Node 22), branche `demo-borne`, auto-deploy à chaque push dessus. 6 vars d'env dont `VITE_DEMO_MODE=true` et `VITE_DEMO_PASSWORD=borne`. Base = LIVE prod, zéro écriture via proxy client.
- **Compte démo** : `demo@runesdechene.com` / mot de passe **`borne`** (reset admin le 1 juil., l'ancien ne matchait pas la valeur Netlify qui était `demo`). Auto-login via useDemoBootstrap.
- **Fix build Netlify** : pnpm 10 bloque le post-install esbuild → ajouté `onlyBuiltDependencies:[esbuild]` + `packageManager: pnpm@10.5.2` dans package.json racine (commit c9d744d).
- **Reste v1 refonte** : migs 271-274 NON appliquées en prod, branche v1-refonte-identite poussée. On tient la release jusqu'à l'écran révélation/QCM prêt.
