# Les énigmes signalées — conception

> 08/10/2026 · V2 (`apps/web-v2`), Hub (`apps/hub`), base (migration 470) · pas de maquette : le style de
> « Signaler ce lieu » · décision dans le `_État.md` d'Explore (Tranché, 08/10) · complète
> `2026-10-07-v2-enigmes-design.md`

## Pourquoi

Les joueurs trouvent les énigmes trop intransigeantes. Exemple : « Eudes » pour « Eudes de Paris » est
refusé, et c'est vécu comme une injustice.

La vérification tolère déjà la casse, les accents, la ponctuation, les articles, le pluriel et une ou deux
fautes de frappe (`_enigma_answer_matches`, migration 003). Ce qu'elle ne peut pas faire, c'est deviner
qu'une réponse **incomplète** est juste, et il ne faut pas l'élargir pour ça : « Paris » passerait aussi.

D'où deux choses :
- **plusieurs réponses acceptées par énigme**, décidées par l'auteur ;
- **le joueur signale** ce qui lui semble faux, et l'équipe tranche dans le Hub. Pas de tableau de toutes
  les mauvaises réponses : seulement ce que les joueurs contestent.

**Pas rétroactif** (Uriel, 08/10) : une réponse acceptée après coup ne change ni les réponses passées, ni les
points, ni les titres.

## Les réponses acceptées

- `enigmas.accepted_answers text[] NOT NULL DEFAULT '{}'` : les variantes, en plus de `answer`.
- `percer_enigme` (seule vérification encore en service depuis le retrait de la V1) : une énigme libre est
  juste si la réponse correspond, avec `_enigma_answer_matches`, à `answer` **ou** à l'une des variantes.
  Les QCM ne changent pas. Le verdict affiche toujours `answer`.
- Réécrite à partir de sa définition **live**, copiée entière.

## Signaler, côté joueur (V2)

- **Où** : en bas de la feuille de l'énigme, **après le verdict**, sous « Le savais-tu ? ». Un lien discret,
  en petit texte : « Signaler une erreur ou une injustice ». Pas avant le verdict : il n'y a encore rien à
  contester.
- **La feuille** (même composition que `FeuilleSignaler` d'un lieu) : titre « Signaler une erreur »,
  trois raisons, un mot facultatif (500 signes), « Envoyer le signalement ».
  - `reponse_refusee` — « Ma réponse aurait dû être acceptée »
  - `erreur` — « La réponse ou l'explication est fausse »
  - `autre` — « Autre chose »
- **Après l'envoi** : « Merci » et « L'équipe va regarder cette énigme de près. », puis Fermer.
- **Erreur** : « Le signalement n’est pas parti. Réessaie dans un instant. », comme pour un lieu.

## En base (migration 470)

- **`signalements_enigme`**, calquée sur `signalements_lieu` (migration 387) :
  `id`, `enigma_id` (→ `enigmas`, cascade), `user_id` (→ `users`, cascade), `raison` (les trois valeurs),
  `precision` (≤ 500), `reponse_donnee` (relevée en base), `cree_le`, `traite_le`, `traite_par`.
  Un seul signalement ouvert par joueur et par énigme (index unique partiel) ; RLS active, aucun accès direct.
- **`signaler_enigme(p_enigme, p_raison, p_precision)`** — joueurs connectés :
  - refuse si le joueur n'a jamais répondu à cette énigme ;
  - `reponse_donnee` = sa **dernière** réponse dans `enigma_responses` : personne ne signale une réponse
    qu'il n'a pas donnée ;
  - vingt signalements par jour au plus, toutes énigmes confondues ;
  - un second signalement ouvert sur la même énigme remplace le premier.
- **`signalements_enigme_du_hub()`** — admins : les signalements ouverts, du plus récent au plus ancien, avec
  l'énigme (n°, question, `answer`, `accepted_answers`, format), la raison, le mot, la réponse donnée, qui
  et quand.
- **`traiter_signalement_enigme(p_id, p_accepter boolean)`** — admins : clôt le signalement ; avec
  `p_accepter`, ajoute d'abord `reponse_donnee` aux variantes (énigme libre seulement, sans doublon) et
  clôt aussi les autres signalements ouverts de cette énigme que la variante rend justes.
- **Auto-tests** dans la migration (comme la 003) : avec « Eudes de Paris » en réponse et « Eudes » en
  variante, « eudes » est juste et « Paris » ne l'est pas.

## Le Hub

- **Formulaire d'une énigme libre** (`Enigmas.tsx`) : un champ « Autres réponses acceptées », une par ligne.
- **Écran « Énigmes signalées »** (`components/enigmes/EnigmesSignalees.tsx`, entrée dans la barre latérale
  près des Énigmes ; `Enigmas.tsx` fait déjà 680 lignes). Une ligne par signalement : énigme n°, question,
  réponse attendue (et variantes), réponse du joueur, raison, mot, qui, quand. Trois actions :
  - **Accepter cette réponse** — énigme libre seulement ; ajoute la variante et clôt ;
  - **Modifier l'énigme** — ouvre la page Énigmes sur cette énigme ;
  - **Clore** — sans suite.
- Rechargement après chaque action, comme `Signalements`.

## Hors champ

- Le tableau de toutes les mauvaises réponses.
- La rétroactivité.
- Prévenir le joueur que sa réponse a été acceptée.

## Vérifier

- Migration appliquée, puis contrôlée en prod (colonnes, fonctions, auto-tests passés).
- V2 : répondre faux, signaler, voir le merci. Hub : voir le signalement, l'accepter, la variante apparaît
  dans le formulaire. Une énigme ne se répond qu'une fois par éveil : la prise en compte des variantes par
  `percer_enigme` est prouvée par les auto-tests et une requête en prod, pas en rejouant.
- `pnpm build` des deux applis, tests V2 au vert.
