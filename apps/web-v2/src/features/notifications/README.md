# notifications — le tiroir de la cloche

Maquette Figma « Notifications (tiroir) — proposition 30/09 ». Base : migration 386.

Ce qui touche tes lieux et toi : cœurs, récits enrichis, photos, commentaires, positions
corrigées, visites et paliers, @mentions du Registre, saluts. Pas les rappels quotidiens ni ce que
la V2 abandonne : la base ne rend que ces sortes (`_notification_v2`).

Les mises à jour de l'app (migration 397) s'y mêlent : « Nouveautés d'Explore », écrites dans le
Hub, qui mènent à la page « Nouveautés ».

- `api/` — `notifications.ts` (lire, compter, marquer lues, écouter les arrivées) ;
  `lireNotifications.ts` (la forme des réponses) ; `nouveautes.ts` (les mises à jour publiées).
- `hooks/` — `useNotifications` (la liste ; l'ouvrir marque tout lu) et `useNonLues` (la
  pastille de la cloche, posée par la coquille) ; `useNouveautes` (les mises à jour publiées).
- `lib/` — `phrase` (la tournure de chaque sorte, en morceaux), `moments` (Aujourd'hui, Cette
  semaine, Plus tôt), `texte` (le texte d'une mise à jour en paragraphes et listes).
- `components/` — `Notifications` (le tiroir), `Nouveautes` (la page des mises à jour).
