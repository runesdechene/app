# hooks — la fiche avec son état

- `useFiche.ts` — la fiche en cache (`undefined` = chargement, `null` = introuvable).
- `usePhraseDePartage.ts` — la phrase de partage réglée dans le Hub (le repli pendant la lecture).
- `useEnvie.ts` — « Envie d'y aller » : bascule tout de suite, revient si la base refuse.
- `useVisite.ts` — visiter en GPS ; une réussite relit la fiche et la carte.
- `useSouvenir.ts` — « J'y suis allé » : le souvenir, puis le mot au carnet s'il y en a un.
- `useRevendication.ts` — qui est là, mes noms d'expédition, revendiquer.
- `useSignalerPresence.ts` — la présence, dès la première position puis une fois par minute.
