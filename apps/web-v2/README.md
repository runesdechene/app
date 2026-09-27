# web-v2 — l'app Runes de Chêne, V2

Front neuf, écrit de zéro, servi sous `app.runesdechene.com/v2/`. Même base Supabase que la V1
(`apps/explore-web`), qu'elle remplacera. Réservé aux comptes autorisés pendant la construction.

- Conception : `docs/superpowers/specs/2026-09-26-v2-socle-design.md` (fondation) et
  `2026-08-18-app-v2-design.md` (écrans).
- Pourquoi c'est construit ainsi : `docs/v2/decisions/`.
- Ce que le back devra perdre : `docs/v2/purge-back.md`.

## Commandes (depuis la racine du dépôt)

| Commande                         | Effet                                             |
| -------------------------------- | ------------------------------------------------- |
| `pnpm dev:v2`                    | serveur local sur http://localhost:5174/v2/       |
| `pnpm --filter web-v2 test`      | tests                                             |
| `pnpm --filter web-v2 lint`      | règles de code                                    |
| `pnpm --filter web-v2 typecheck` | types                                             |
| `pnpm build:v2`                  | build de production dans `apps/web-v2/dist`       |
| `pnpm --filter web-v2 gen:types` | régénère les types de la base après une migration |

Node 22.22 minimum (React Router 8).

## Tester en local avec une session

La V2 lit la session de la V1 (même origine). En local :

1. `pnpm dev` (V1, port 3000) **et** `pnpm dev:v2` (V2, port 5174) ;
2. ouvrir **http://localhost:5174/** — c'est la V1, servie par le proxy de la V2 — et se
   connecter avec le code reçu par email ;
3. ouvrir **http://localhost:5174/v2/** : même origine, même session.

## PWA

Installable, portée `/v2/`. Icônes dans `public/` (découpées dans l'emblème du logotype, brut) :
`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`. Pour les
remplacer, écraser les fichiers sous le même nom.

## Où sont les choses

Voir `src/README.md`.
