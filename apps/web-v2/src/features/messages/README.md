# messages — l'onglet Messages

Conception : `docs/superpowers/specs/2026-08-18-app-v2-design.md`, §10 ; maquettes Figma 45:278 (le
Registre) et 264:128 / 264:162 / 264:185 (les Murmures, version zen). Base : migrations 371-373.

« Un chat de MMO, pas une messagerie. » Deux onglets : **La communauté** (le Registre, public — les
canaux « général » et « Bugs & suggestions » de la table `chat_messages`, partagée avec la V1) et
**Les Murmures** (privés, à deux) : « comme un murmure, une douceur » — pas de bulles, beaucoup
d'air, le moment ne s'écrit qu'après un silence, ni « en ligne » ni « en train d'écrire ».

- `api/` — `registre.ts` et `murmures.ts` (lire, écrire, écouter en direct) ; `lireRegistre.ts`,
  `lireMurmures.ts` (la forme des réponses).
- `hooks/` — `useRegistre`, `useMentions` (la mention en cours, les Explorateurs proposés),
  `useMurmures` (la liste, une conversation et son en-tête ; ouvrir une
  conversation marque lus les murmures reçus).
- `lib/` — `moment` (« ce matin », « hier soir »), `presence` (« Dernière connexion il y a 2 j »),
  `suite` (grouper les messages d'affilée), `mentions` (repérer, insérer, afficher « @Nom »).
- `components/` — `MessagesScreen` (les deux onglets), `Registre`, `ListeMurmures`, `Conversation`,
  `BarreEcrire` (la barre d'écriture, la même partout), `ChoixCanal` et `ListeMentions` (les deux
  menus, au style commun `Menu.module.css`).
- À venir : la pastille de non-lus sur l'onglet ; le menhir dessiné par Uriel pour une conversation
  vide.
