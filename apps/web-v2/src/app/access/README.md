# access — la porte de la V2

Décide au démarrage si ce compte peut ouvrir la V2.

- `decideAccess.ts` — la règle, en fonction pure : état de la session → entrer, attendre, réessayer, ou repartir vers la V1.
- `useV2Access.ts` — va chercher cet état (session Supabase + RPC `has_v2_access`), avec un délai et une nouvelle vérification à chaque connexion ou déconnexion.
- `AccessGate.tsx` — applique la décision à l'écran.

On n'y range pas : les droits d'un écran particulier (ils vivent dans sa zone).
