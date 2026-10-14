# styles — renvoi

Les jetons (`tokens.css`) et la remise à zéro (`global.css`) vivent dans le paquet partagé
`packages/da` (`@runes/da`), importé par `src/main.tsx`. Ce dossier ne garde que le test qui
vérifie que chaque `var(--…)` de la V2 existe dans les jetons.

Pour voir toute la DA d'un coup : `/da`.
