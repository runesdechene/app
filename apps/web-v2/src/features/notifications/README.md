# notifications — le tiroir de la cloche

Maquette Figma « Notifications (tiroir) — proposition 30/09 ». Base : migration 386.

Ce qui touche tes lieux et toi : cœurs, récits enrichis, photos, commentaires, positions
corrigées, visites et paliers, @mentions du Registre, saluts. Pas les rappels quotidiens ni ce que
la V2 abandonne : la base ne rend que ces sortes (`_notification_v2`).

- `api/` — `notifications.ts` (lire, compter, marquer lues, écouter les arrivées) ;
  `lireNotifications.ts` (la forme des réponses).
- `hooks/` — `useNotifications` (la liste ; l'ouvrir marque tout lu) et `useNonLues` (la
  pastille de la cloche, posée par la coquille).
- `lib/` — `phrase` (la tournure de chaque sorte, en morceaux), `moments` (Aujourd'hui, Cette
  semaine, Plus tôt).
- `components/` — `Notifications` (le tiroir).
