# src — le code de la V2

| Dossier      | Ce qu'on y range                                                                   | Ce qu'on n'y range pas                        |
| ------------ | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| `app/`       | la coquille : démarrage, routes, garde d'accès, navigation                         | un écran métier                               |
| `features/`  | une zone de l'app par dossier (accueil, carte, messages, codex, campement, compte) | du code partagé entre zones                   |
| `shared/`    | ce que plusieurs zones utilisent : client Supabase, briques d'interface, styles    | quoi que ce soit propre à une zone            |
| `assets/ui/` | les images de l'interface (brut Figma, remplaçables)                               | des images de contenu                         |
| `test/`      | la préparation commune des tests                                                   | des tests (ils vivent à côté de leur fichier) |

## Les trois règles (vérifiées par ESLint)

1. Un composant ne parle jamais à Supabase : il appelle un hook, qui passe par `api/`.
2. Une zone n'importe jamais une autre zone.
3. Rien n'importe la V1.

## Lire un fichier

Chaque fichier commence par `QUOI` (ce qu'il fait), `POURQUOI` (sa raison d'être) et parfois
`ATTENTION` (le piège). Commencer par là.
