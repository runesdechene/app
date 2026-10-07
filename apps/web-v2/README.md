# web-v2 — Runes de Chêne Explore

L'appli servie à la racine d'`app.runesdechene.com` depuis la bascule du 07/10/2026 (spec
`docs/superpowers/specs/2026-10-07-v2-bascule-design.md`). Elle a remplacé la V1 ; le Campement y
viendra en zone réservée aux Porteurs.

- Conception : `docs/superpowers/specs/2026-09-26-v2-socle-design.md` (fondation) et
  `2026-08-18-app-v2-design.md` (écrans).
- Pourquoi c'est construit ainsi : `docs/v2/decisions/`.
- Ce que le back devra perdre : `docs/v2/purge-back.md`.

## Commandes (depuis la racine du dépôt)

| Commande                         | Effet                                             |
| -------------------------------- | ------------------------------------------------- |
| `pnpm dev`                       | serveur local sur http://localhost:5174/          |
| `pnpm --filter web-v2 test`      | tests                                             |
| `pnpm --filter web-v2 lint`      | règles de code                                    |
| `pnpm --filter web-v2 typecheck` | types                                             |
| `pnpm build`                     | build de production dans `apps/web-v2/dist`       |
| `pnpm --filter web-v2 gen:types` | régénère les types de la base après une migration |

Node 22.22 minimum (React Router 8). Déployer : `.claude/rules/deploiement.md`.

## Tester en local avec une session

Ouvrir http://localhost:5174/bienvenue et se connecter avec le code reçu par e-mail ; la session
reste sur cette adresse.

## PWA

Installable, portée `/`. Service worker maison (`src/sw.ts`) : précache, liste blanche des écrans
(`src/sw/ecrans.ts`), notifications push ; une nouvelle version s'annonce par une fenêtre
(`src/app/NouvelleVersion.tsx`). Icônes dans `public/` : `icon-192.png`, `icon-512.png`,
`icon-512-maskable.png`, `apple-touch-icon.png`. `pwa-*.png`, `email-*`, `res/` et `v2/sw.js`
sont servis pour d'autres que l'appli (V1 installées, e-mails, tutoriel du Hub, ancienne portée).

## Où sont les choses

Voir `src/README.md`.
