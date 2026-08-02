---
updated: 2026-08-02T10:00:00Z
summary: "Écran d'intro de la borne démo refondu et EN LIGNE (demo.runesdechene.com, commit 091ce133). Nouveau wording : « Une marque sur le dos. Une communauté dans la poche. », kicker qui identifie l'app, tagline à la 3e personne, encart stand sans jargon + teaser scan au futur, CTA en vrai bouton plein or. Nouveau composant DemoLiveProof : compteurs réels + dernières découvertes qui défilent (get_landing_stats / get_landing_activity). Sauvegarde de l'ancien écran : tag git demo-intro-v1 + rollback Netlify. La release v1 refonte-identité reste garée."
next_step: "Vérifier l'écran sur la borne (hard refresh) : lisibilité du CTA à distance et défilement du bandeau preuve vivante. Préciser ce qu'affichera le scan du Fragment pour resserrer la phrase du teaser. Sinon revenir à la release v1 (écran révélation + QCM)."
---

<!-- Statut lu par XO sur la carte d'accueil. À tenir à jour à chaque session. -->

## Tâches

- [ ] Voir l'écran d'intro refondu sur la vraie borne (lisibilité à 2 m, bandeau preuve vivante)
- [ ] Définir ce qu'affichera le scan du Fragment (RA ?) → ajuster le teaser de l'encart stand
- [ ] Release v1 refonte-identité : écran révélation « ta Maison devient ta classe » + QCM « Quel explorateur es-tu ? » (branche v1-refonte-identite)
- [ ] Release coordonnée v1 : db push migs 271-274 + netlify deploy app prod

## Mémoire

- **Refonte écran d'intro borne (2 août)** : spec `apps/explore-web/docs/superpowers/specs/2026-08-02-demo-intro-refonte-wording-design.md`. Problème traité : le passant du stand ne faisait pas le lien entre « Portez l'Histoire » et une app mobile, et la communauté n'était nulle part. Composants : `DemoKioskShell` (contenu) + nouveau `DemoLiveProof` (bandeau preuve vivante, lecture seule, rend `null` si le réseau du stand lâche). CSS mort `.demo-mantra-*` supprimé. **Retour arrière** : tag `demo-intro-v1` (commit 0744d50c) ou rollback Netlify en un clic.
- **Démo borne (fait le 1 juil.)** : site Netlify `runesdechene-demo` (id 01d23d77-db08-4ecd-a0b6-f2b76035deb6), domaine `demo.runesdechene.com`, CNAME `demo` → `runesdechene-demo.netlify.app`. Build **sur Netlify** (base `apps/explore-web`, `pnpm build`, Node 22), branche `demo-borne`, auto-deploy à chaque push dessus. 6 vars d'env dont `VITE_DEMO_MODE=true` et `VITE_DEMO_PASSWORD=borne`. Base = LIVE prod, zéro écriture via proxy client.
- **Compte démo** : `demo@runesdechene.com` / mot de passe **`borne`** (reset admin le 1 juil., l'ancien ne matchait pas la valeur Netlify qui était `demo`). Auto-login via useDemoBootstrap.
- **Fix build Netlify** : pnpm 10 bloque le post-install esbuild → ajouté `onlyBuiltDependencies:[esbuild]` + `packageManager: pnpm@10.5.2` dans package.json racine (commit c9d744d).
- **Reste v1 refonte** : migs 271-274 NON appliquées en prod, branche v1-refonte-identite poussée. On tient la release jusqu'à l'écran révélation/QCM prêt.
