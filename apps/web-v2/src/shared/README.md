# shared — ce que plusieurs zones utilisent

- `supabase/` — le client unique et les types de la base. Seuls les dossiers `api/` des zones
  (et la garde d'accès) l'importent.
- `lib/` — le calcul pur partagé : les lecteurs du JSON de la base (`lire.ts`) ; le signal
  « un écran est derrière moi » que les zones posent sur un lien et que le cadre de détail lit
  (`retour.ts`) ; la distance à vol d'oiseau (`distance.ts`) ; la position de celui qui
  regarde, seulement si déjà autorisée — jamais de demande (`position.ts`) ; « il y a 10 min »
  (`ilYA.ts`).
- `hooks/` — la logique avec état partagée : `useMaPosition` (cette position, gardée dix
  minutes), `useGlisser` (tenir et tirer une rangée à la souris), `useEnvols` (les cœurs qui
  s'envolent d'un bouton).
- `ui/` — les briques d'interface génériques, dont `LieuCarte` (la grande carte photo d'un lieu,
  du profil et de l'Accueil).
- `styles/` — les jetons de la DA et la remise à zéro CSS.

Règle d'entrée : un fichier monte ici quand **une deuxième zone** en a besoin, pas avant.
