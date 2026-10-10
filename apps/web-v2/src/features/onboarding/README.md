# onboarding — l'entrée dans Explore

Maquettes Figma 94:107 à 95:107 ; décisions d'Uriel du 27/09 (`_État.md` d'Explore) : la Charte se
lit en entier avant de se signer, au pouce maintenu ; un seul rouge par écran. Base : migration 370
(Charte, nom, « mon entrée ») et 369 (les Fragments réclamés avec l'e-mail vérifié).

On y entre depuis la vitrine (`features/vitrine`, `/bienvenue`) : `/bienvenue/<étape>` — `preambule`, `email`, `code`, puis
`charte` et `nom` s'ils manquent au compte, `calendrier` juste après `nom`, et `fin` —, **hors de la garde d'accès** : on y arrive
sans compte. La Charte se signe une fois connecté : un compte qui l'a déjà signée ne la revoit pas
(08/10). Chaque écran a son adresse ; ce qu'on a dit (l'e-mail, la connexion faite) voyage avec la
navigation (`useParcours`).

- `api/` — `entree.ts` (code par e-mail, Fragments, Charte, nom, mon entrée) et
  `lireEntree.ts` (la forme des réponses).
- `hooks/` — `useParcours` (l'état qui voyage), `useEntrer` (le code, puis l'écran suivant),
  `useLuJusquauBout` (la fin de la Charte passée à l'écran).
- `lib/` — `enLettres` (« Deux Fragments »).
- `components/` — `Onboarding` (une étape par adresse), `Page` (le cadre commun), et un fichier
  par écran : `Preambule`, `Charte`, `Email`, `Code`, `Nom`, `Calendrier`, `Bienvenue`.
