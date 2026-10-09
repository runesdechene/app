# hooks — la fiche avec son état

- `useFiche.ts` — la fiche en cache (`undefined` = chargement, `null` = introuvable).
- `useEnvie.ts` — « Envie d'y aller » : bascule tout de suite, revient si la base refuse.
- `usePosition.ts` — ma position suivie tant que la fiche est ouverte, ou pourquoi on ne l'a pas.
- `useVisite.ts` — visiter en GPS ; une réussite relit la fiche et la carte.
- `useRevendication.ts` — qui est là, mes noms d'expédition, revendiquer.
- `useSignalerPresence.ts` — la présence, une fois par minute, position déjà autorisée seulement.
