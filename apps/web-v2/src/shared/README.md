# shared — ce que plusieurs zones utilisent

- `supabase/` — le client unique, les types de la base, et l'envoi des photos d'un lieu
  (`photos.ts` : ajout, modification, Carnet). Seuls les dossiers `api/` des zones
  (et la garde d'accès) l'importent.
- `lib/` — le calcul pur partagé : les lecteurs du JSON de la base (`lire.ts`) ; le lieu retenu
  pour après l'inscription (`apresEntree.ts`) ; la distance à vol d'oiseau (`distance.ts`) ; la position de celui qui
  regarde, seulement si déjà autorisée — jamais de demande (`position.ts`) ; « il y a 10 min »
  (`ilYA.ts`) ; réduire une photo et lire sa position (`photo.ts`) ; la validité d'un pin, 15 jours (`validitePin.ts`) ; dire un endroit en mots et chercher une adresse (`adresse.ts`, Nominatim).
- `hooks/` — la logique avec état partagée : `useMaPosition` (cette position, gardée dix
  minutes), `useGlisser` (tenir et tirer une rangée à la souris), `useEnvols` (les cœurs qui
  s'envolent d'un bouton), `useUrlDe` (l'adresse d'une photo pas encore envoyée).
- `ui/` — les briques d'interface génériques, dont `LieuCarte` (la grande carte photo d'un lieu,
  du profil et de l'Accueil).
- `styles/` — les jetons de la DA et la remise à zéro CSS.

Règle d'entrée : un fichier monte ici quand **une deuxième zone** en a besoin, pas avant.
