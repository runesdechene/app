# ui — les briques d'interface

Toute brique vit ici **et** sur la page `/v2/da` — un test échoue sinon. Aucune ne parle à
Supabase ; aucune n'écrit une valeur visuelle en dur (Stylelint).

- `Text` — les douze styles de texte (`textVariants.ts`). Le seul moyen d'écrire du texte stylé.
- `Button` — principal, secondaire, discret ; état désactivé.
- `IconButton` — bouton rond à icône, libellé pour les lecteurs d'écran.
- `Pastille` — non-lus : rien à zéro, « 9+ » au-delà de 9.
- `EmptyState` — le message centré d'un écran encore vide.
