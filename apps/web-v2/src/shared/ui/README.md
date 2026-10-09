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
- `Feuille` — le panneau qui monte du bas (au centre sur PC) ; voile et Échap ferment.
- `racineDesFeuilles.ts` — où les feuilles se posent (la coquille) : leur voile couvre toute l'app.
- `Champ` — saisie avec libellé, aide et limite tenue à la frappe.
- `PastilleChoix` — un titre porté : en lecture, ou à choisir.
- `BilleType` — la bille d'un type de lieu : sa couleur, son icône en blanc (Accueil, Ajouter).
- `Envols` — les cœurs qui s'envolent d'un bouton, un par toucher (saluts, cœurs d'un lieu).
- `Segments` — un choix exclusif en segments ; la zone éclairée glisse sous le choix.
- `PlanSatellite` — le plan satellite d'un endroit (pose d'un pin, étape « Où » de l'ajout).
