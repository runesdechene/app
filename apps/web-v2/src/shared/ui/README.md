# ui — les briques d'interface

Toute brique vit ici **et** sur la page `/v2/da` — un test échoue sinon. Aucune ne parle à
Supabase ; aucune n'écrit une valeur visuelle en dur (Stylelint).

- `Text` — les douze styles de texte (`textVariants.ts`). Le seul moyen d'écrire du texte stylé.
- `Button` — principal, secondaire, discret ; état désactivé.
- `IconButton` — bouton rond à icône, libellé pour les lecteurs d'écran.
- `Pastille` — non-lus : rien à zéro, « 9+ » au-delà de 9.
- `EmptyState` — le message centré d'un écran encore vide.
- `Avatar` — photo ronde, ou l'initiale ; petit (menu) ou grand (profil).
- `Interrupteur` — le switch des Préférences ; `role="switch"`.
- `Feuille` — le panneau qui monte du bas (menu avatar) ; voile et Échap ferment.
- `Champ` — saisie avec libellé, aide et limite tenue à la frappe.
- `PastilleChoix` — un titre porté : en lecture, ou à choisir.
- `Segments` — un choix exclusif en segments ; la zone éclairée glisse sous le choix.
