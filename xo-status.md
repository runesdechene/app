---
updated: 2026-07-01T18:00:00Z
summary: "Démo borne EN LIGNE sur demo.runesdechene.com. Popup Bienvenue retravaillé : sous-phrase carte vivante 3000+ lieux + les 3 points (Explore/Découvre/Résous) en ligne horizontale sans sous-titres, wording Veilleur, accent terracotta. Écran d'intro : 'chaque article acheté sur le stand'. Tout poussé sur demo-borne → Netlify redéploie. La release v1 refonte-identité reste garée."
next_step: "Vérifier sur la borne (hard refresh) que le popup Bienvenue s'affiche bien. Optionnel : déposer apps/explore-web/public/demo-intro.jpg. Sinon revenir à la release v1 (écran révélation + QCM)."
---

<!-- Statut lu par XO sur la carte d'accueil. À tenir à jour à chaque session. -->

## Tâches

- [ ] (Optionnel) Déposer `apps/explore-web/public/demo-intro.jpg` + push demo-borne → fond de l'écran d'intro
- [ ] Release v1 refonte-identité : écran révélation « ta Maison devient ta classe » + QCM « Quel explorateur es-tu ? » (branche v1-refonte-identite)
- [ ] Release coordonnée v1 : db push migs 271-274 + netlify deploy app prod

## Mémoire

- **Démo borne (fait le 1 juil.)** : site Netlify `runesdechene-demo` (id 01d23d77-db08-4ecd-a0b6-f2b76035deb6), domaine `demo.runesdechene.com`, CNAME `demo` → `runesdechene-demo.netlify.app`. Build **sur Netlify** (base `apps/explore-web`, `pnpm build`, Node 22), branche `demo-borne`, auto-deploy à chaque push dessus. 6 vars d'env dont `VITE_DEMO_MODE=true` et `VITE_DEMO_PASSWORD=borne`. Base = LIVE prod, zéro écriture via proxy client.
- **Compte démo** : `demo@runesdechene.com` / mot de passe **`borne`** (reset admin le 1 juil., l'ancien ne matchait pas la valeur Netlify qui était `demo`). Auto-login via useDemoBootstrap.
- **Fix build Netlify** : pnpm 10 bloque le post-install esbuild → ajouté `onlyBuiltDependencies:[esbuild]` + `packageManager: pnpm@10.5.2` dans package.json racine (commit c9d744d).
- **Reste v1 refonte** : migs 271-274 NON appliquées en prod, branche v1-refonte-identite poussée. On tient la release jusqu'à l'écran révélation/QCM prêt.
